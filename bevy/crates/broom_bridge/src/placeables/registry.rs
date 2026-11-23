//! The component types a game lets the editor place, registered with
//! [`AppPlaceableExt::register_placeable`].

use std::collections::BTreeMap;

use bevy::prelude::*;
use bevy::reflect::{GetTypeRegistration, TypePath};

use crate::protocol::{
    PlaceableClassAbsorb, PlaceableClassRename, PlaceableCollisionKind, PlaceableIoPin,
    PlaceableMarkerBox, PlaceablePlacement,
};

/// The default sRGB color of editor markers.
const DEFAULT_MARKER_COLOR: Srgba = Srgba::rgb(0.35, 0.65, 0.95);

/// How the editor offers one placeable component.
#[derive(Clone, Debug, PartialEq)]
pub struct PlaceableOptions {
    /// Shown instead of the type's short name when set.
    pub label: Option<String>,
    /// Add menu category.
    pub category: String,
    pub placement: PlaceablePlacement,
    pub marker_color: Srgba,
    /// The editor icon name drawn on markers and listed in menus.
    pub icon: Option<String>,
    /// The editor marker box of entities whose box no field value picks.
    pub marker_box: Option<PlaceableMarkerBox>,
    /// The field path whose value picks a box from `marker_boxes`.
    pub marker_box_field: Option<String>,
    /// Editor marker boxes by the text value of `marker_box_field`.
    pub marker_boxes: BTreeMap<String, PlaceableMarkerBox>,
    /// The field path whose value a volume marker writes on its floor.
    pub marker_label_field: Option<String>,
    /// The bool field path that draws a volume marker hatched while true.
    pub marker_hatched_when_true: Option<String>,
    /// The enum list field path whose entries a volume marker draws as floor bands.
    pub marker_runs_field: Option<String>,
    /// Type paths this class had before; the editor rewrites old components into it.
    pub renamed_from: Vec<PlaceableClassRename>,
    /// Components of other classes this class takes over by an enum value.
    pub absorbs: Vec<PlaceableClassAbsorb>,
    /// Old enum values by field path, each mapped to the value it means now.
    pub renamed_variants: BTreeMap<String, BTreeMap<String, String>>,
    /// The collision kind brush entities carrying this class take; solid when unset.
    pub collision: Option<PlaceableCollisionKind>,
    /// Declared entity I/O inputs on this class.
    pub inputs: Vec<PlaceableIoPin>,
    /// Declared entity I/O outputs on this class.
    pub outputs: Vec<PlaceableIoPin>,
}

impl PlaceableOptions {
    /// A component that can be attached to any object.
    pub fn any() -> Self {
        Self {
            label: None,
            category: "Game".into(),
            placement: PlaceablePlacement::Any,
            marker_color: DEFAULT_MARKER_COLOR,
            icon: None,
            marker_box: None,
            marker_box_field: None,
            marker_boxes: BTreeMap::new(),
            marker_label_field: None,
            marker_hatched_when_true: None,
            marker_runs_field: None,
            renamed_from: Vec::new(),
            absorbs: Vec::new(),
            renamed_variants: BTreeMap::new(),
            collision: None,
            inputs: Vec::new(),
            outputs: Vec::new(),
        }
    }

    /// A component that only lives on game entities (empty points).
    pub fn point() -> Self {
        Self {
            placement: PlaceablePlacement::Point,
            ..Self::any()
        }
    }

    /// Makes brush entities carrying the class take `kind` as their collision, such as
    /// [`PlaceableCollisionKind::Volume`] for a finish zone.
    pub fn collision(mut self, kind: PlaceableCollisionKind) -> Self {
        self.collision = Some(kind);
        self
    }

    /// Uses `category` as the Add menu category.
    pub fn category(mut self, category: impl Into<String>) -> Self {
        self.category = category.into();
        self
    }

    /// Shows `label` instead of the type's short name.
    pub fn label(mut self, label: impl Into<String>) -> Self {
        self.label = Some(label.into());
        self
    }

    /// Tints the editor marker of game entities carrying this component.
    pub fn marker_color(mut self, color: Srgba) -> Self {
        self.marker_color = color;
        self
    }

    /// Shows the editor icon named `icon`, such as `lightbulb`, on markers and in menus.
    pub fn icon(mut self, icon: impl Into<String>) -> Self {
        self.icon = Some(icon.into());
        self
    }

    /// Draws the editor marker of game entities carrying this component as a box of `size`
    /// whose centre sits at `offset` from the entity's origin, in metres in the entity's space.
    pub fn marker_box(mut self, size: Vec3, offset: Vec3) -> Self {
        self.marker_box = Some(marker_box_of(size, offset));
        self
    }

    /// Picks the editor marker box by the value of the field at `field_path`, using the boxes
    /// given with [`Self::marker_box_for`]; other values keep [`Self::marker_box`].
    pub fn marker_box_field(mut self, field_path: impl Into<String>) -> Self {
        self.marker_box_field = Some(field_path.into());
        self
    }

    /// Draws the editor marker as a box of `size` centred at `offset` while the marker box
    /// field's value, as text, is `value`.
    pub fn marker_box_for(mut self, value: impl Into<String>, size: Vec3, offset: Vec3) -> Self {
        self.marker_boxes
            .insert(value.into(), marker_box_of(size, offset));
        self
    }

    /// Draws the binary glTF model at `model`, a path relative to the project's asset root,
    /// inside the editor marker box picked by the field value `value`. A value without a box
    /// given with [`Self::marker_box_for`] is left without a model.
    pub fn marker_model_for(mut self, value: &str, model: impl Into<String>) -> Self {
        if let Some(marker_box) = self.marker_boxes.get_mut(value) {
            marker_box.model = Some(model.into());
        }
        self
    }

    /// Writes the value of the field at `field_path` as a label on the floor of the editor's
    /// volume marker; the labels of an enum list are joined by " · ".
    pub fn marker_label_field(mut self, field_path: impl Into<String>) -> Self {
        self.marker_label_field = Some(field_path.into());
        self
    }

    /// Draws the editor's volume marker hatched, as blocked, while the bool field at
    /// `field_path` is true.
    pub fn marker_hatched_when_true(mut self, field_path: impl Into<String>) -> Self {
        self.marker_hatched_when_true = Some(field_path.into());
        self
    }

    /// Draws the entries of the enum list field at `field_path` as equal bands on the floor of
    /// the editor's volume marker, in list order from the negative end of the volume's longer
    /// local horizontal axis (X on a tie), each labelled with its number and variant label.
    pub fn marker_runs_field(mut self, field_path: impl Into<String>) -> Self {
        self.marker_runs_field = Some(field_path.into());
        self
    }

    /// Records that this class was called `type_path` before, so the editor rewrites levels
    /// holding the old name.
    pub fn renamed_from(mut self, type_path: impl Into<String>) -> Self {
        self.renamed_from
            .push(PlaceableClassRename::TypePath(type_path.into()));
        self
    }

    /// Takes over components of another class whose enum field holds one of the given values.
    pub fn absorbs(mut self, absorb: PlaceableClassAbsorb) -> Self {
        self.absorbs.push(absorb);
        self
    }

    /// Records that the enum field at `field_path` used to hold `old`, which is `new` now.
    pub fn variant_renamed(
        mut self,
        field_path: impl Into<String>,
        old: impl Into<String>,
        new: impl Into<String>,
    ) -> Self {
        self.renamed_variants
            .entry(field_path.into())
            .or_default()
            .insert(old.into(), new.into());
        self
    }

    /// Declares an entity I/O input pin on this class.
    pub fn with_input(mut self, pin: PlaceableIoPin) -> Self {
        self.inputs.push(pin);
        self
    }

    /// Declares an entity I/O output pin on this class.
    pub fn with_output(mut self, pin: PlaceableIoPin) -> Self {
        self.outputs.push(pin);
        self
    }
}

/// The wire form of a marker box.
fn marker_box_of(size: Vec3, offset: Vec3) -> PlaceableMarkerBox {
    PlaceableMarkerBox {
        size: size.to_array(),
        offset: offset.to_array(),
        model: None,
    }
}

impl Default for PlaceableOptions {
    fn default() -> Self {
        Self::any()
    }
}

/// Every placeable component by type path.
#[derive(Resource, Clone, Debug, Default)]
pub struct PlaceableClasses {
    registrations: BTreeMap<String, PlaceableOptions>,
    generation: u64,
}

impl PlaceableClasses {
    /// Registers or replaces the options of the component at `type_path`.
    pub fn register(&mut self, type_path: impl Into<String>, options: PlaceableOptions) {
        self.registrations.insert(type_path.into(), options);
        self.generation += 1;
    }

    /// Whether the component at `type_path` may be placed.
    pub fn contains(&self, type_path: &str) -> bool {
        self.registrations.contains_key(type_path)
    }

    /// Every registration, sorted by type path.
    pub fn iter(&self) -> impl Iterator<Item = (&str, &PlaceableOptions)> {
        self.registrations
            .iter()
            .map(|(type_path, options)| (type_path.as_str(), options))
    }

    /// How many components are registered.
    pub fn len(&self) -> usize {
        self.registrations.len()
    }

    /// Whether no component is registered.
    pub fn is_empty(&self) -> bool {
        self.registrations.is_empty()
    }

    /// Changes whenever a registration changes.
    pub fn generation(&self) -> u64 {
        self.generation
    }
}

/// Registers placeable components on an [`App`].
pub trait AppPlaceableExt {
    /// Lets the editor place `T`. The type is reflected and registered with its `Component`
    /// and `Default` data, so its fields and defaults reach the editor.
    fn register_placeable<T>(&mut self, options: PlaceableOptions) -> &mut Self
    where
        T: Component + Reflect + TypePath + Default + GetTypeRegistration;
}

impl AppPlaceableExt for App {
    fn register_placeable<T>(&mut self, options: PlaceableOptions) -> &mut Self
    where
        T: Component + Reflect + TypePath + Default + GetTypeRegistration,
    {
        self.register_type::<T>()
            .register_type_data::<T, ReflectComponent>()
            .register_type_data::<T, ReflectDefault>();
        self.world_mut()
            .get_resource_or_init::<PlaceableClasses>()
            .register(T::type_path(), options);
        self
    }
}

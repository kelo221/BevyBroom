//! Data assets: reflected values kept in their own files, like Unity ScriptableObjects.
//! [`AppDataAssetExt::register_data_asset`] registers a loader for the type and lets the editor
//! read and write its files. A file is a RON map of the fields that differ from the type's
//! `Default`, by field path, in the normalized value form component overrides use:
//!
//! ```ron
//! {
//!     "health": 150.0,
//! }
//! ```

use std::marker::PhantomData;

use bevy::asset::io::Reader;
use bevy::asset::{AssetLoader, LoadContext};
use bevy::prelude::*;
use bevy::reflect::{FromReflect, GetTypeRegistration, TypePath, TypeRegistry, TypeRegistryArc};

use super::assets::{PlaceableAssetRegistration, PlaceableAssetTypes};
use super::compose::{ComposeContext, compose};
use crate::protocol::{DataAssetValues, validate_data_asset_values};

/// Loads data asset files of type `A`.
#[derive(TypePath)]
pub struct DataAssetLoader<A: Asset> {
    registry: TypeRegistryArc,
    extensions: Vec<&'static str>,
    marker: PhantomData<fn() -> A>,
}

impl<A: Asset + FromReflect> AssetLoader for DataAssetLoader<A> {
    type Asset = A;
    type Settings = ();
    type Error = BevyError;

    async fn load(
        &self,
        reader: &mut dyn Reader,
        _settings: &(),
        load_context: &mut LoadContext<'_>,
    ) -> Result<A, BevyError> {
        let mut bytes = Vec::new();
        reader.read_to_end(&mut bytes).await?;
        let values = data_asset_values_parse(std::str::from_utf8(&bytes)?)?;
        let (value, errors) = data_asset_compose::<A>(&self.registry.read(), &values)?;
        for error in errors {
            warn!("broom bridge: {}: {error}", load_context.path());
        }
        Ok(value)
    }

    fn extensions(&self) -> &[&str] {
        &self.extensions
    }
}

/// The overrides in a data asset file's text; an empty file overrides nothing.
pub fn data_asset_values_parse(text: &str) -> Result<DataAssetValues, String> {
    if text.trim().is_empty() {
        return Ok(DataAssetValues::new());
    }
    let values: DataAssetValues =
        ron::from_str(text).map_err(|error| format!("not a data asset file: {error}"))?;
    validate_data_asset_values(&values)?;
    Ok(values)
}

/// The text of a data asset file holding `values`.
pub fn data_asset_values_format(values: &DataAssetValues) -> Result<String, String> {
    ron::ser::to_string_pretty(values, ron::ser::PrettyConfig::default())
        .map_err(|error| error.to_string())
}

/// `A` built from its default with `values` applied, and the overrides that could not be.
/// Asset fields inside data assets are not supported and keep their default.
pub(crate) fn data_asset_compose<A: FromReflect + TypePath>(
    registry: &TypeRegistry,
    values: &DataAssetValues,
) -> Result<(A, Vec<String>), String> {
    let assets = PlaceableAssetTypes::default();
    let context = ComposeContext {
        registry,
        assets: &assets,
        asset_server: None,
    };
    let composed = compose(&context, A::type_path(), values)?;
    let value = A::from_reflect(composed.value.as_partial_reflect())
        .ok_or_else(|| format!("{} cannot be built from its fields", A::type_path()))?;
    Ok((value, composed.errors))
}

/// Registers data asset types on an [`App`].
pub trait AppDataAssetExt {
    /// Makes `A` a data asset kept in files ending in `.{extension}` (e.g. `door.ron`): its
    /// files load as `A`, `Handle<A>` fields may reference them, and the editor may read and
    /// write them. Needs the asset plugin.
    fn register_data_asset<A>(&mut self, extension: &'static str) -> &mut Self
    where
        A: Asset + FromReflect + GetTypeRegistration + Default;
}

impl AppDataAssetExt for App {
    fn register_data_asset<A>(&mut self, extension: &'static str) -> &mut Self
    where
        A: Asset + FromReflect + GetTypeRegistration + Default,
    {
        let registry = self.world().resource::<AppTypeRegistry>().0.clone();
        self.init_asset::<A>()
            .register_type::<A>()
            .register_type_data::<A, ReflectDefault>()
            .register_asset_loader(DataAssetLoader::<A> {
                registry,
                extensions: vec![extension],
                marker: PhantomData,
            });
        self.world_mut()
            .get_resource_or_init::<PlaceableAssetTypes>()
            .register(PlaceableAssetRegistration::of::<A>(&[extension], true));
        self
    }
}

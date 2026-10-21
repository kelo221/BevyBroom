//! Asset types that `Handle` fields of placeable components may reference, registered with
//! [`AppPlaceableAssetExt::register_placeable_asset`]. Each registration knows how to load a
//! typed handle from an asset path and how to read the path back.

use std::any::TypeId;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::path::Path;

use bevy::prelude::*;
use bevy::reflect::PartialReflect;

use crate::protocol::PlaceableAssetType;

/// Loads a typed handle for an asset path.
pub type AssetHandleLoader = fn(&AssetServer, &str) -> Box<dyn PartialReflect>;

/// Reads the asset path of a typed handle, if it has one.
pub type AssetHandlePathRead = fn(&dyn PartialReflect) -> Option<String>;

/// One asset type the editor may reference.
#[derive(Clone, Debug)]
pub struct PlaceableAssetRegistration {
    pub asset_type_path: String,
    pub label: String,
    /// File extensions without the dot, e.g. `png` or `door.ron`.
    pub extensions: Vec<String>,
    /// Whether the editor may read and write files of this type as data assets.
    pub editable: bool,
    /// The type id of `Handle<A>`.
    pub handle_type_id: TypeId,
    pub load: AssetHandleLoader,
    /// Creates a handle that references no asset.
    pub empty: fn() -> Box<dyn PartialReflect>,
    pub path_read: AssetHandlePathRead,
}

impl PlaceableAssetRegistration {
    /// The registration of asset type `A` with `extensions`.
    pub fn of<A: Asset>(extensions: &[&str], editable: bool) -> Self {
        Self {
            asset_type_path: A::type_path().to_owned(),
            label: A::short_type_path().to_owned(),
            extensions: extensions
                .iter()
                .map(|extension| (*extension).to_owned())
                .collect(),
            editable,
            handle_type_id: TypeId::of::<Handle<A>>(),
            load: handle_load::<A>,
            empty: handle_empty::<A>,
            path_read: handle_path_read::<A>,
        }
    }

    /// Whether `file_name` ends with one of the registered extensions.
    pub fn matches_file_name(&self, file_name: &str) -> bool {
        self.extensions
            .iter()
            .any(|extension| file_name.ends_with(&format!(".{extension}")))
    }
}

/// Loads a `Handle<A>` for `path`.
fn handle_load<A: Asset>(server: &AssetServer, path: &str) -> Box<dyn PartialReflect> {
    Box::new(server.load::<A>(path.to_owned()))
}

/// A `Handle<A>` that references no asset.
fn handle_empty<A: Asset>() -> Box<dyn PartialReflect> {
    Box::new(Handle::<A>::default())
}

/// The asset path of a `Handle<A>`.
fn handle_path_read<A: Asset>(value: &dyn PartialReflect) -> Option<String> {
    let handle = value.try_downcast_ref::<Handle<A>>()?;
    handle.path().map(ToString::to_string)
}

/// Every registered asset type.
#[derive(Resource, Clone, Debug, Default)]
pub struct PlaceableAssetTypes {
    registrations: Vec<PlaceableAssetRegistration>,
}

impl PlaceableAssetTypes {
    /// Adds or replaces the registration of its asset type.
    pub fn register(&mut self, registration: PlaceableAssetRegistration) {
        self.registrations
            .retain(|existing| existing.asset_type_path != registration.asset_type_path);
        self.registrations.push(registration);
    }

    /// The registration whose `Handle` has `handle_type_id`.
    pub fn by_handle_type(&self, handle_type_id: TypeId) -> Option<&PlaceableAssetRegistration> {
        self.registrations
            .iter()
            .find(|registration| registration.handle_type_id == handle_type_id)
    }

    /// The registration of the asset type at `asset_type_path`.
    pub fn by_asset_type_path(&self, asset_type_path: &str) -> Option<&PlaceableAssetRegistration> {
        self.registrations
            .iter()
            .find(|registration| registration.asset_type_path == asset_type_path)
    }

    /// The registrations the editor may read and write as data assets.
    pub fn editable(&self) -> impl Iterator<Item = &PlaceableAssetRegistration> {
        self.registrations
            .iter()
            .filter(|registration| registration.editable)
    }

    /// Every asset type with the matching files under `asset_root`, and a counter that changes
    /// when any of those files appear or disappear.
    pub fn describe(&self, asset_root: &Path) -> (Vec<PlaceableAssetType>, u64) {
        let files = asset_files(asset_root);
        let mut hasher = DefaultHasher::new();
        let described = self
            .registrations
            .iter()
            .map(|registration| {
                let paths: Vec<String> = files
                    .iter()
                    .filter(|path| registration.matches_file_name(path))
                    .cloned()
                    .collect();
                paths.hash(&mut hasher);
                describe_one(registration, paths)
            })
            .collect();
        (described, hasher.finish())
    }
}

/// The wire description of one registration.
fn describe_one(
    registration: &PlaceableAssetRegistration,
    paths: Vec<String>,
) -> PlaceableAssetType {
    PlaceableAssetType {
        type_path: registration.asset_type_path.clone(),
        label: registration.label.clone(),
        extensions: registration.extensions.clone(),
        editable: registration.editable,
        paths,
        fields: Vec::new(),
    }
}

/// Every file under `asset_root` as a sorted `/`-separated asset path.
fn asset_files(asset_root: &Path) -> Vec<String> {
    let mut files = Vec::new();
    collect_files(asset_root, "", &mut files);
    files.sort();
    files
}

/// Appends the files under `directory`, whose asset path starts with `prefix`, to `files`.
fn collect_files(directory: &Path, prefix: &str, files: &mut Vec<String>) {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        let asset_path = format!("{prefix}{name}");
        match entry.file_type() {
            Ok(kind) if kind.is_dir() => {
                collect_files(&entry.path(), &format!("{asset_path}/"), files)
            }
            Ok(kind) if kind.is_file() => files.push(asset_path),
            _ => {}
        }
    }
}

/// Registers asset types that placeable `Handle` fields may reference.
pub trait AppPlaceableAssetExt {
    /// Lets `Handle<A>` fields of placeable components reference files with `extensions`.
    fn register_placeable_asset<A: Asset>(&mut self, extensions: &[&str]) -> &mut Self;
}

impl AppPlaceableAssetExt for App {
    fn register_placeable_asset<A: Asset>(&mut self, extensions: &[&str]) -> &mut Self {
        self.world_mut()
            .get_resource_or_init::<PlaceableAssetTypes>()
            .register(PlaceableAssetRegistration::of::<A>(extensions, false));
        self
    }
}

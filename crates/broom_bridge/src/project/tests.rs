use std::path::Path;

use super::*;
use crate::test_support::SAMPLE_PROJECT as SAMPLE;

#[test]
fn sample_project_parses_and_resolves_paths() {
    let config = ProjectConfig::parse(SAMPLE).expect("the sample project parses");
    assert!(!config.project_id.is_empty());
    let paths = ProjectPaths::resolve(&config, Path::new("game"));
    assert_eq!(paths.asset_root, Path::new("game").join(&config.asset_root));
    assert!(paths.catalog_file.starts_with(&paths.asset_root));
    assert!(paths.level_directory.starts_with(&paths.asset_root));
    let asset = paths.level_asset_path("castle", "geometry_1.glb");
    assert_eq!(
        asset,
        format!("{}/castle/geometry_1.glb", config.level_directory)
    );
}

#[test]
fn rejects_paths_outside_the_project_and_unknown_versions() {
    let escaping = SAMPLE.replacen(
        "\"asset_root\": \"assets\"",
        "\"asset_root\": \"../other\"",
        1,
    );
    assert_ne!(
        escaping, SAMPLE,
        "the sample must name its asset root `assets`"
    );
    assert!(ProjectConfig::parse(&escaping).is_err());
    let future = SAMPLE.replacen("\"project_version\": 1", "\"project_version\": 99", 1);
    assert!(ProjectConfig::parse(&future).is_err());
}

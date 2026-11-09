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

#[test]
fn texture_directories_default_to_empty_and_stay_inside_the_project() {
    let sample = ProjectConfig::parse(SAMPLE).expect("the sample project parses");
    assert!(!sample.texture_directories.is_empty());
    let mut value: serde_json::Value = serde_json::from_str(SAMPLE).expect("sample is JSON");
    let object = value.as_object_mut().expect("sample is an object");
    object.remove("texture_directories");
    let without = ProjectConfig::parse(&value.to_string()).expect("the field is optional");
    assert!(without.texture_directories.is_empty());
    for escaping in ["../outside", "/absolute", "textures/../../outside"] {
        value["texture_directories"] = serde_json::json!(["textures", escaping]);
        let error = ProjectConfig::parse(&value.to_string()).expect_err("escaping is rejected");
        assert!(error.contains("texture_directories"), "{error}");
    }
}

#[test]
fn sprinkle_directories_default_to_empty_and_stay_inside_the_project() {
    let mut value: serde_json::Value = serde_json::from_str(SAMPLE).expect("sample is JSON");
    let object = value.as_object_mut().expect("sample is an object");
    object.remove("sprinkle_directories");
    let without = ProjectConfig::parse(&value.to_string()).expect("the field is optional");
    assert!(without.sprinkle_directories.is_empty());
    value["sprinkle_directories"] = serde_json::json!(["sprinkle", "props/foliage"]);
    let listed = ProjectConfig::parse(&value.to_string()).expect("contained entries parse");
    assert_eq!(listed.sprinkle_directories, ["sprinkle", "props/foliage"]);
    for escaping in ["../outside", "/absolute", "sprinkle/../../outside"] {
        value["sprinkle_directories"] = serde_json::json!(["sprinkle", escaping]);
        let error = ProjectConfig::parse(&value.to_string()).expect_err("escaping is rejected");
        assert!(error.contains("sprinkle_directories"), "{error}");
    }
}

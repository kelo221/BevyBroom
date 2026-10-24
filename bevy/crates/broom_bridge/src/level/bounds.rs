//! Tight culling bounds for level geometry.
//!
//! The editor exports a solid model's material runs as primitives that share one vertex buffer.
//! The glTF loader, and Bevy's own bounds computation, give every such primitive the box of the
//! whole buffer, so each one is culled and shadow-tested as if it covered the entire model. Here
//! each level primitive gets the box of the vertices its triangles actually use, and Bevy is told
//! not to overwrite it when the mesh asset changes later (the catalog binding flips its UVs).

use bevy::camera::primitives::Aabb;
use bevy::camera::visibility::NoAutoAabb;
use bevy::mesh::VertexAttributeValues;
use bevy::prelude::*;

use super::loading::LevelGeometryRoot;

/// A level primitive whose bounds wait for its mesh asset.
#[derive(Component)]
pub(super) struct TightBoundsPending;

/// A level primitive whose [`Aabb`] covers only the vertices it draws.
#[derive(Component, Reflect, Default, Clone, Copy, Debug, PartialEq, Eq)]
#[reflect(Component, Default)]
pub struct TightBounds;

/// The box around the vertices `mesh` draws: those its indices name, or all of them when it has
/// none. `None` when it has no float positions or no vertex to draw.
pub(crate) fn drawn_vertex_bounds(mesh: &Mesh) -> Option<Aabb> {
    let Some(VertexAttributeValues::Float32x3(positions)) =
        mesh.attribute(Mesh::ATTRIBUTE_POSITION)
    else {
        return None;
    };
    let point = |index: usize| positions.get(index).map(|p| Vec3::from_array(*p));
    match mesh.indices() {
        Some(indices) => Aabb::enclosing(indices.iter().filter_map(point)),
        None => Aabb::enclosing(positions.iter().map(|p| Vec3::from_array(*p))),
    }
}

/// Marks new primitives under a level geometry root: they keep the bounds set here.
pub(super) fn mark_new_level_primitives(
    mut commands: Commands,
    added: Query<Entity, Added<Mesh3d>>,
    parents: Query<&ChildOf>,
    roots: Query<(), With<LevelGeometryRoot>>,
) {
    for entity in &added {
        if parents
            .iter_ancestors(entity)
            .any(|ancestor| roots.contains(ancestor))
        {
            commands
                .entity(entity)
                .insert((NoAutoAabb, TightBoundsPending));
        }
    }
}

/// Gives marked primitives the box of the vertices they draw once their mesh is loaded. Apps
/// without mesh assets (headless tools) have nothing to tighten.
pub(super) fn tighten_level_bounds(
    mut commands: Commands,
    meshes: Option<Res<Assets<Mesh>>>,
    pending: Query<(Entity, &Mesh3d), With<TightBoundsPending>>,
) {
    let Some(meshes) = meshes else {
        return;
    };
    for (entity, mesh) in &pending {
        let Some(mesh) = meshes.get(mesh) else {
            continue;
        };
        let mut primitive = commands.entity(entity);
        primitive.remove::<TightBoundsPending>();
        if let Some(aabb) = drawn_vertex_bounds(mesh) {
            primitive.insert((aabb, TightBounds));
        }
    }
}

#[cfg(test)]
mod tests {
    use bevy::asset::RenderAssetUsages;
    use bevy::mesh::{Indices, PrimitiveTopology};

    use super::*;

    /// Two triangles far apart in one buffer; `indices` picks which are drawn.
    fn shared_buffer_mesh(indices: Option<Vec<u32>>) -> Mesh {
        let positions: Vec<[f32; 3]> = vec![
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [100.0, 0.0, 0.0],
            [101.0, 0.0, 0.0],
            [100.0, 1.0, 5.0],
        ];
        let mut mesh = Mesh::new(PrimitiveTopology::TriangleList, RenderAssetUsages::all())
            .with_inserted_attribute(Mesh::ATTRIBUTE_POSITION, positions);
        if let Some(indices) = indices {
            mesh.insert_indices(Indices::U32(indices));
        }
        mesh
    }

    #[test]
    fn bounds_cover_only_the_vertices_the_indices_draw() {
        let aabb = drawn_vertex_bounds(&shared_buffer_mesh(Some(vec![3, 4, 5]))).unwrap();
        assert_eq!(
            aabb,
            Aabb::from_min_max(Vec3::new(100.0, 0.0, 0.0), Vec3::new(101.0, 1.0, 5.0))
        );
    }

    #[test]
    fn bounds_without_indices_cover_every_vertex() {
        let aabb = drawn_vertex_bounds(&shared_buffer_mesh(None)).unwrap();
        assert_eq!(
            aabb,
            Aabb::from_min_max(Vec3::ZERO, Vec3::new(101.0, 1.0, 5.0))
        );
    }

    #[test]
    fn indices_past_the_buffer_are_ignored_and_nothing_drawn_gives_no_bounds() {
        let aabb = drawn_vertex_bounds(&shared_buffer_mesh(Some(vec![0, 1, 2, 99]))).unwrap();
        assert_eq!(
            aabb,
            Aabb::from_min_max(Vec3::ZERO, Vec3::new(1.0, 1.0, 0.0))
        );
        assert!(drawn_vertex_bounds(&shared_buffer_mesh(Some(vec![]))).is_none());
    }

    /// A level root with a primitive under it and a game mesh outside it, both with the shared
    /// buffer's full box the glTF loader would give them.
    fn bounds_app() -> (App, Entity, Entity) {
        let mut app = App::new();
        app.add_plugins(MinimalPlugins)
            .add_plugins(AssetPlugin::default())
            .init_asset::<Mesh>()
            .add_systems(
                Update,
                (mark_new_level_primitives, tighten_level_bounds).chain(),
            );
        let mesh = app
            .world_mut()
            .resource_mut::<Assets<Mesh>>()
            .add(shared_buffer_mesh(Some(vec![3, 4, 5])));
        let loader_box = Aabb::from_min_max(Vec3::ZERO, Vec3::new(101.0, 1.0, 5.0));
        let root = app
            .world_mut()
            .spawn(LevelGeometryRoot {
                geometry_revision: 1,
                file_name: "geometry_0000000000000001.glb".to_owned(),
            })
            .id();
        let node = app.world_mut().spawn(ChildOf(root)).id();
        let primitive = app
            .world_mut()
            .spawn((Mesh3d(mesh.clone()), loader_box, ChildOf(node)))
            .id();
        let game_mesh = app.world_mut().spawn((Mesh3d(mesh), loader_box)).id();
        (app, primitive, game_mesh)
    }

    #[test]
    fn level_primitives_get_tight_bounds_that_bevy_keeps_and_game_meshes_are_left_alone() {
        let (mut app, primitive, game_mesh) = bounds_app();
        app.update();
        let world = app.world();
        assert_eq!(
            world.get::<Aabb>(primitive),
            Some(&Aabb::from_min_max(
                Vec3::new(100.0, 0.0, 0.0),
                Vec3::new(101.0, 1.0, 5.0)
            ))
        );
        assert!(world.get::<NoAutoAabb>(primitive).is_some());
        assert!(world.get::<TightBoundsPending>(primitive).is_none());
        assert!(world.get::<TightBounds>(primitive).is_some());
        assert_eq!(
            world.get::<Aabb>(game_mesh),
            Some(&Aabb::from_min_max(Vec3::ZERO, Vec3::new(101.0, 1.0, 5.0)))
        );
        assert!(world.get::<NoAutoAabb>(game_mesh).is_none());
        assert!(world.get::<TightBounds>(game_mesh).is_none());
    }
}

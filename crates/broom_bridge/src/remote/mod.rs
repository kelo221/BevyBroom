//! The editor's connection: Bevy's remote protocol over local HTTP with the `broom.*`
//! methods. Responses allow any origin so the editor can call it from a browser tab or the
//! desktop webview. Development only: it accepts any local caller.

mod handlers;
#[cfg(test)]
mod tests;

use std::net::{IpAddr, Ipv4Addr};

use bevy::prelude::*;
use bevy::remote::RemotePlugin;
use bevy::remote::http::{Headers, RemoteHttpPlugin};

use crate::protocol::ProtocolRange;

/// The default port, Bevy's own remote default.
pub const DEFAULT_PORT: u16 = 15702;

/// Every method the bridge adds, by name.
pub const METHODS: [&str; 11] = [
    "broom.apply_state",
    "broom.publish_geometry",
    "broom.status",
    "broom.catalog",
    "broom.read_asset",
    "broom.bake_preview",
    "broom.load_level",
    "broom.placeable_classes",
    "broom.data_asset_read",
    "broom.data_asset_write",
    "broom.hello",
];

/// The protocol range `broom.hello` advertises.
#[derive(Resource, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct AdvertisedProtocol(pub ProtocolRange);

/// Adds the remote protocol with the `broom.*` methods on loopback `port`, advertising
/// `protocol` in the handshake.
pub fn add_remote(app: &mut App, port: u16, protocol: ProtocolRange) {
    app.insert_resource(AdvertisedProtocol(protocol));
    let remote = RemotePlugin::default()
        .with_method_main(METHODS[0], handlers::apply_state)
        .with_method_main(METHODS[1], handlers::publish_geometry)
        .with_method_main(METHODS[2], handlers::status)
        .with_method_main(METHODS[3], handlers::catalog)
        .with_method_main(METHODS[4], handlers::read_asset)
        .with_method_main(METHODS[5], handlers::bake_preview)
        .with_method_main(METHODS[6], handlers::load_level)
        .with_method_main(METHODS[7], handlers::placeable_classes)
        .with_method_main(METHODS[8], handlers::data_asset_read)
        .with_method_main(METHODS[9], handlers::data_asset_write)
        .with_method_main(METHODS[10], handlers::hello);
    let headers = Headers::new()
        .insert("Access-Control-Allow-Origin", "*")
        .insert("Access-Control-Allow-Headers", "Content-Type");
    app.add_plugins((
        remote,
        RemoteHttpPlugin::default()
            .with_address(IpAddr::V4(Ipv4Addr::LOCALHOST))
            .with_port(port)
            .with_headers(headers),
    ));
}

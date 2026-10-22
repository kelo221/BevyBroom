//! The authored state the editor sends: every object's identity, hierarchy and local transform,
//! plus light, room and portal definitions and placed game components. Geometry and material
//! assignments travel in the published GLB.

use serde::{Deserialize, Serialize};

use super::hello::{MIN_PROTOCOL_VERSION, protocol_supported};
use super::light::AuthoredLight;
use super::placeable::{AuthoredComponents, validate_components};
use super::portal::{AuthoredPortal, AuthoredRoom};

/// The newest wire protocol version. Requests outside
/// [`MIN_PROTOCOL_VERSION`](super::hello::MIN_PROTOCOL_VERSION)`..=PROTOCOL_VERSION` are rejected.
pub const PROTOCOL_VERSION: u32 = 4;

/// A complete, lightweight snapshot of one editor document.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct AuthoredState {
    pub protocol: u32,
    /// The game project the document belongs to; empty when the editor has no project open.
    #[serde(default)]
    pub project_id: String,
    /// Stable across saves and reopenings of the same document.
    pub document_id: String,
    /// Changes every time the editor starts; revisions are only comparable within a session.
    pub session_id: String,
    /// Increases with every snapshot the editor builds in this session.
    pub revision: u64,
    /// The newest geometry revision the editor has published or is publishing.
    #[serde(default)]
    pub geometry_revision: u64,
    pub objects: Vec<AuthoredObject>,
}

/// What an authored object is.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum AuthoredObjectKind {
    #[default]
    Mesh,
    Group,
    /// A CSG model root whose compiled result mesh is exported as its child.
    Solid,
    Light,
    /// A DynLight room cell.
    Room,
    /// A DynLight portal between room cells.
    Portal,
    /// An empty point that exists to carry game components.
    GameEntity,
}

/// One object of the editor's hierarchy.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct AuthoredObject {
    /// The editor's stable object id.
    pub id: String,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub name: String,
    pub kind: AuthoredObjectKind,
    #[serde(default = "visible_by_default")]
    pub visible: bool,
    /// Local translation in meters, Bevy axes (Y up, right-handed).
    pub translation: [f32; 3],
    /// Local rotation quaternion `[x, y, z, w]`.
    pub rotation: [f32; 4],
    pub scale: [f32; 3],
    /// Present on lights only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub light: Option<AuthoredLight>,
    /// Present on rooms only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub room: Option<AuthoredRoom>,
    /// Present on portals only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub portal: Option<AuthoredPortal>,
    /// Game components placed on the object, on any kind.
    #[serde(default, skip_serializing_if = "AuthoredComponents::is_empty")]
    pub components: AuthoredComponents,
}

/// Serde default for [`AuthoredObject::visible`].
fn visible_by_default() -> bool {
    true
}

impl Default for AuthoredObject {
    fn default() -> Self {
        Self {
            id: String::new(),
            parent_id: None,
            name: String::new(),
            kind: AuthoredObjectKind::Mesh,
            visible: true,
            translation: [0.0; 3],
            rotation: [0.0, 0.0, 0.0, 1.0],
            scale: [1.0; 3],
            light: None,
            room: None,
            portal: None,
            components: AuthoredComponents::new(),
        }
    }
}

/// Why a snapshot was refused.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum StateRejection {
    WrongProtocol(u32),
    MissingDocumentId,
    MissingSessionId,
    EmptyObjectId {
        index: usize,
    },
    DuplicateObjectId(String),
    LightWithoutSettings(String),
    InvalidLight {
        id: String,
        reason: String,
    },
    RoomWithoutSettings(String),
    InvalidRoom {
        id: String,
        reason: String,
    },
    PortalWithoutSettings(String),
    InvalidPortal {
        id: String,
        reason: String,
    },
    InvalidComponents {
        id: String,
        reason: String,
    },
    NonFiniteTransform(String),
    /// The state names a project other than the running game's.
    WrongProject {
        sent: String,
        running: String,
    },
}

impl core::fmt::Display for StateRejection {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::WrongProtocol(found) => {
                write!(
                    f,
                    "protocol {found} is not supported (expected {MIN_PROTOCOL_VERSION} to {PROTOCOL_VERSION})"
                )
            }
            Self::WrongProject { sent, running } => write!(
                f,
                "the document belongs to project \"{sent}\" but this game runs project \"{running}\""
            ),
            Self::MissingDocumentId => f.write_str("the state has no document_id"),
            Self::MissingSessionId => f.write_str("the state has no session_id"),
            Self::EmptyObjectId { index } => write!(f, "object {index} has an empty id"),
            Self::DuplicateObjectId(id) => write!(f, "object id {id} appears twice"),
            Self::LightWithoutSettings(id) => write!(f, "light {id} has no light settings"),
            Self::InvalidLight { id, reason } => write!(f, "light {id}: {reason}"),
            Self::RoomWithoutSettings(id) => write!(f, "room {id} has no room settings"),
            Self::InvalidRoom { id, reason } => write!(f, "room {id}: {reason}"),
            Self::PortalWithoutSettings(id) => write!(f, "portal {id} has no portal settings"),
            Self::InvalidPortal { id, reason } => write!(f, "portal {id}: {reason}"),
            Self::InvalidComponents { id, reason } => write!(f, "object {id}: {reason}"),
            Self::NonFiniteTransform(id) => write!(f, "object {id} has a non-finite transform"),
        }
    }
}

impl AuthoredState {
    /// Checks everything the bridge relies on before it touches the world. The first problem
    /// found is returned.
    pub fn validate(&self) -> Result<(), StateRejection> {
        if !protocol_supported(self.protocol) {
            return Err(StateRejection::WrongProtocol(self.protocol));
        }
        if self.document_id.is_empty() {
            return Err(StateRejection::MissingDocumentId);
        }
        if self.session_id.is_empty() {
            return Err(StateRejection::MissingSessionId);
        }
        let mut seen = std::collections::HashSet::new();
        for (index, object) in self.objects.iter().enumerate() {
            object.validate(index)?;
            if !seen.insert(object.id.as_str()) {
                return Err(StateRejection::DuplicateObjectId(object.id.clone()));
            }
        }
        Ok(())
    }

    /// Refuses a state that names a project other than `running_project_id`. A state without
    /// a project id comes from an editor with no project and is accepted.
    pub fn project_check(&self, running_project_id: &str) -> Result<(), StateRejection> {
        if self.project_id.is_empty() || self.project_id == running_project_id {
            return Ok(());
        }
        Err(StateRejection::WrongProject {
            sent: self.project_id.clone(),
            running: running_project_id.to_owned(),
        })
    }

    /// The object with `id`, if any.
    pub fn object(&self, id: &str) -> Option<&AuthoredObject> {
        self.objects.iter().find(|object| object.id == id)
    }
}

impl AuthoredObject {
    /// Checks one object; `index` names it in the error when the id itself is missing.
    fn validate(&self, index: usize) -> Result<(), StateRejection> {
        if self.id.is_empty() {
            return Err(StateRejection::EmptyObjectId { index });
        }
        let finite = self
            .translation
            .iter()
            .chain(&self.rotation)
            .chain(&self.scale)
            .all(|value| value.is_finite());
        if !finite {
            return Err(StateRejection::NonFiniteTransform(self.id.clone()));
        }
        validate_components(&self.components).map_err(|reason| {
            StateRejection::InvalidComponents {
                id: self.id.clone(),
                reason,
            }
        })?;
        match self.kind {
            AuthoredObjectKind::Light => self.validate_light(),
            AuthoredObjectKind::Room => self.validate_room(),
            AuthoredObjectKind::Portal => self.validate_portal(),
            AuthoredObjectKind::Mesh
            | AuthoredObjectKind::Group
            | AuthoredObjectKind::Solid
            | AuthoredObjectKind::GameEntity => Ok(()),
        }
    }

    /// A light needs valid light settings.
    fn validate_light(&self) -> Result<(), StateRejection> {
        let Some(light) = &self.light else {
            return Err(StateRejection::LightWithoutSettings(self.id.clone()));
        };
        light
            .validate()
            .map_err(|reason| StateRejection::InvalidLight {
                id: self.id.clone(),
                reason,
            })
    }

    /// A room needs valid room settings.
    fn validate_room(&self) -> Result<(), StateRejection> {
        let Some(room) = &self.room else {
            return Err(StateRejection::RoomWithoutSettings(self.id.clone()));
        };
        room.validate()
            .map_err(|reason| StateRejection::InvalidRoom {
                id: self.id.clone(),
                reason,
            })
    }

    /// A portal needs valid portal settings.
    fn validate_portal(&self) -> Result<(), StateRejection> {
        let Some(portal) = &self.portal else {
            return Err(StateRejection::PortalWithoutSettings(self.id.clone()));
        };
        portal
            .validate()
            .map_err(|reason| StateRejection::InvalidPortal {
                id: self.id.clone(),
                reason,
            })
    }
}

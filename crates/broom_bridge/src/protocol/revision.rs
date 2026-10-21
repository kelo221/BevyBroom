//! Ordering of snapshots and geometry publications, so a late request never replaces newer
//! data.

/// Where a revision stands relative to what was already accepted.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RevisionVerdict {
    /// Newer than everything accepted in this session.
    Newer,
    /// The same revision again (a resend): harmless, nothing to do.
    Repeat,
    /// Older than an accepted revision: must be ignored.
    Stale,
    /// The editor restarted or switched documents: accept and start over.
    NewSession,
}

impl RevisionVerdict {
    /// Whether the data should be applied.
    pub fn accepts(self) -> bool {
        matches!(self, Self::Newer | Self::NewSession)
    }
}

/// The newest accepted revision of one stream (state or geometry) per editor session.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct RevisionGate {
    session_id: Option<String>,
    document_id: Option<String>,
    revision: u64,
}

impl RevisionGate {
    /// Judges `revision` from `session_id` editing `document_id`, without recording it.
    pub fn judge(&self, document_id: &str, session_id: &str, revision: u64) -> RevisionVerdict {
        let same_session = self.session_id.as_deref() == Some(session_id)
            && self.document_id.as_deref() == Some(document_id);
        if !same_session {
            return RevisionVerdict::NewSession;
        }
        match revision.cmp(&self.revision) {
            core::cmp::Ordering::Greater => RevisionVerdict::Newer,
            core::cmp::Ordering::Equal => RevisionVerdict::Repeat,
            core::cmp::Ordering::Less => RevisionVerdict::Stale,
        }
    }

    /// Judges and, when accepted, records the revision as the newest.
    pub fn admit(&mut self, document_id: &str, session_id: &str, revision: u64) -> RevisionVerdict {
        let verdict = self.judge(document_id, session_id, revision);
        if verdict.accepts() {
            self.session_id = Some(session_id.to_owned());
            self.document_id = Some(document_id.to_owned());
            self.revision = revision;
        }
        verdict
    }

    /// Forgets `revision` when it is still the newest accepted one, falling back to `fallback`,
    /// so a resend of the same revision is accepted again. Used when an accepted revision could
    /// not be applied.
    pub fn forget(&mut self, revision: u64, fallback: u64) {
        if self.revision == revision {
            self.revision = fallback.min(revision);
        }
    }

    /// The newest accepted revision, 0 before any.
    pub fn revision(&self) -> u64 {
        self.revision
    }

    /// The document of the newest accepted revision.
    pub fn document_id(&self) -> Option<&str> {
        self.document_id.as_deref()
    }

    /// The session of the newest accepted revision.
    pub fn session_id(&self) -> Option<&str> {
        self.session_id.as_deref()
    }
}

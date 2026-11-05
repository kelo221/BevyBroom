//! Target name wildcard matching (`*` and `?`) and `!self` resolution for entity I/O.
//! Clean-room Rust implementation inspired by Hammer++ and ReactiveLogic
//! (MIT License, Copyright (c) 2023 Henry de Jongh).

use bevy::prelude::*;

/// Returns whether `candidate` matches `pattern`, where `*` matches any sequence of characters
/// and `?` matches any single character.
pub fn wildcard_matches(pattern: &str, candidate: &str) -> bool {
    let pattern = pattern.trim();
    if pattern.is_empty() || candidate.is_empty() {
        return false;
    }
    if !pattern.contains('*') && !pattern.contains('?') {
        return pattern == candidate;
    }
    let pat_chars: Vec<char> = pattern.chars().collect();
    let cand_chars: Vec<char> = candidate.chars().collect();
    wildcard_slice_match(&pat_chars, &cand_chars)
}

fn wildcard_slice_match(pattern: &[char], candidate: &[char]) -> bool {
    let (mut p_idx, mut c_idx) = (0, 0);
    let (mut star_idx, mut match_idx) = (None, 0);
    while c_idx < candidate.len() {
        if p_idx < pattern.len() && (pattern[p_idx] == '?' || pattern[p_idx] == candidate[c_idx]) {
            p_idx += 1;
            c_idx += 1;
        } else if p_idx < pattern.len() && pattern[p_idx] == '*' {
            star_idx = Some(p_idx);
            match_idx = c_idx;
            p_idx += 1;
        } else if let Some(star) = star_idx {
            p_idx = star + 1;
            match_idx += 1;
            c_idx = match_idx;
        } else {
            return false;
        }
    }
    while p_idx < pattern.len() && pattern[p_idx] == '*' {
        p_idx += 1;
    }
    p_idx == pattern.len()
}

/// Resolves all entities in `named_entities` matching `target_pattern` (`!self`, exact name, or
/// wildcard).
pub fn resolve_targets<'a>(
    source: Entity,
    target_pattern: &str,
    named_entities: impl IntoIterator<Item = (Entity, &'a str)>,
) -> Vec<Entity> {
    let trimmed = target_pattern.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    if trimmed == "!self" {
        return vec![source];
    }
    named_entities
        .into_iter()
        .filter_map(|(entity, name)| wildcard_matches(trimmed, name).then_some(entity))
        .collect()
}

//! Command line of the preview.

use std::path::PathBuf;

/// What the preview was started with.
#[derive(Clone, Debug, PartialEq)]
pub struct PreviewArguments {
    /// `--project FILE`: the project file, `broom.project.json` by default.
    pub project: PathBuf,
    /// `--port N`: the bridge port.
    pub port: u16,
    /// `--level NAME`: load this level from its manifest at startup, as the game would.
    pub level: Option<String>,
    /// `--frames N`: exit after N frames (smoke tests).
    pub frames: Option<u32>,
    /// `--screenshot FILE`: with `--frames`, save the last frame there.
    pub screenshot: Option<PathBuf>,
    /// `--bake`: request a preview bake once the level is shown.
    pub bake: bool,
    /// `--hidden`: never show the window; rendering, bakes and the bridge keep running (tests).
    pub hidden: bool,
}

impl PreviewArguments {
    /// Parses `arguments` (without the program name).
    pub fn parse(arguments: impl IntoIterator<Item = String>) -> Result<Self, String> {
        let mut parsed = Self {
            project: PathBuf::from(broom_bridge::project::PROJECT_FILE_NAME),
            port: broom_bridge::remote::DEFAULT_PORT,
            level: None,
            frames: None,
            screenshot: None,
            bake: false,
            hidden: false,
        };
        let mut arguments = arguments.into_iter();
        while let Some(flag) = arguments.next() {
            let mut value = || {
                arguments
                    .next()
                    .ok_or_else(|| format!("{flag} needs a value"))
            };
            match flag.as_str() {
                "--project" => parsed.project = PathBuf::from(value()?),
                "--port" => parsed.port = number(&flag, &value()?)?,
                "--level" => parsed.level = Some(value()?),
                "--frames" => parsed.frames = Some(number(&flag, &value()?)?),
                "--screenshot" => parsed.screenshot = Some(PathBuf::from(value()?)),
                "--bake" => parsed.bake = true,
                "--hidden" => parsed.hidden = true,
                other => return Err(format!("unknown argument {other}")),
            }
        }
        Ok(parsed)
    }
}

/// Parses `text` as the number `flag` needs.
fn number<T: std::str::FromStr>(flag: &str, text: &str) -> Result<T, String> {
    text.parse()
        .map_err(|_| format!("{flag} needs a number, got {text:?}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Parses `line` split on spaces.
    fn parse(line: &str) -> Result<PreviewArguments, String> {
        PreviewArguments::parse(line.split_whitespace().map(str::to_owned))
    }

    #[test]
    fn defaults_and_flags() {
        let defaults = parse("").expect("no arguments");
        assert_eq!(defaults.port, broom_bridge::remote::DEFAULT_PORT);
        assert!(defaults.level.is_none());
        assert!(!defaults.hidden);
        let full =
            parse("--project game/p.json --port 1234 --level keep --frames 5 --bake --hidden")
                .expect("all flags");
        assert_eq!(full.project, PathBuf::from("game/p.json"));
        assert_eq!((full.port, full.frames, full.bake), (1234, Some(5), true));
        assert!(full.hidden);
        assert_eq!(full.level.as_deref(), Some("keep"));
    }

    #[test]
    fn rejects_unknown_flags_and_bad_numbers() {
        assert!(parse("--wat").is_err());
        assert!(parse("--port many").is_err());
        assert!(parse("--level").is_err());
    }
}

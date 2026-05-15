use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedUnit {
    pub title: String,
    pub description: String,
    pub icon: String,
    pub color: String,
    pub target_language: Option<String>,
    pub source_language: Option<String>,
    pub level: Option<String>,
    pub course_id: Option<String>,
    pub lessons: Vec<UnitLesson>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitLesson {
    pub title: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub exercises: Vec<Value>,
}

pub fn parse_unit_markdown(raw: &str) -> ParsedUnit {
    let (frontmatter, content) = split_frontmatter(raw);
    let fm = parse_yaml_map(frontmatter.unwrap_or_default());
    let mut lessons = Vec::new();
    let lesson_re = Regex::new(r"(?m)^---[ \t]*\n([\s\S]*?)\n---[ \t]*$").unwrap();
    let blocks: Vec<_> = lesson_re.find_iter(content).collect();

    for (idx, mat) in blocks.iter().enumerate() {
        let meta_text = &content[mat.start() + 4..mat.end() - 4];
        let meta = parse_yaml_map(meta_text);
        let next_start = blocks
            .get(idx + 1)
            .map(|m| m.start())
            .unwrap_or(content.len());
        let exercise_text = content[mat.end()..next_start].trim();
        lessons.push(UnitLesson {
            title: meta
                .get("lessonTitle")
                .or_else(|| meta.get("title"))
                .cloned()
                .unwrap_or_else(|| "Untitled".into()),
            description: meta.get("description").cloned(),
            icon: meta.get("icon").cloned(),
            color: meta.get("color").cloned(),
            exercises: parse_exercises(exercise_text),
        });
    }

    ParsedUnit {
        title: fm
            .get("unitTitle")
            .or_else(|| fm.get("title"))
            .cloned()
            .unwrap_or_else(|| "Untitled".into()),
        description: fm.get("description").cloned().unwrap_or_default(),
        icon: fm.get("icon").cloned().unwrap_or_else(|| "📘".into()),
        color: fm.get("color").cloned().unwrap_or_else(|| "#4CAF50".into()),
        target_language: fm.get("targetLanguage").cloned(),
        source_language: fm.get("sourceLanguage").cloned(),
        level: fm.get("level").cloned(),
        course_id: fm.get("courseId").cloned(),
        lessons,
    }
}

fn split_frontmatter(raw: &str) -> (Option<&str>, &str) {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        return (None, raw);
    }
    let rest = &trimmed[3..];
    if let Some(end) = rest.find("\n---") {
        let fm = &rest[..end];
        let content = &rest[end + 4..];
        (Some(fm), content)
    } else {
        (None, raw)
    }
}

fn parse_yaml_map(text: &str) -> std::collections::HashMap<String, String> {
    let value: serde_yaml::Value = serde_yaml::from_str(text).unwrap_or(serde_yaml::Value::Null);
    let mut out = std::collections::HashMap::new();
    if let serde_yaml::Value::Mapping(map) = value {
        for (k, v) in map {
            if let Some(key) = k.as_str() {
                let value = v.as_str().map(str::to_string).unwrap_or_else(|| match v {
                    serde_yaml::Value::Number(n) => n.to_string(),
                    serde_yaml::Value::Bool(b) => b.to_string(),
                    _ => String::new(),
                });
                out.insert(key.to_string(), value);
            }
        }
    }
    out
}

pub fn parse_exercises(content: &str) -> Vec<Value> {
    let mut blocks = Vec::new();
    let mut current = Vec::new();
    for line in content
        .lines()
        .filter(|l| !l.trim_start().starts_with("//"))
    {
        let trimmed = line.trim();
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            if !current.is_empty() {
                blocks.push(current.join("\n"));
            }
            current = vec![line.to_string()];
        } else if trimmed == "---" {
            continue;
        } else {
            current.push(line.to_string());
        }
    }
    if !current.is_empty() {
        blocks.push(current.join("\n"));
    }
    blocks
        .into_iter()
        .filter_map(|b| parse_exercise(&b))
        .collect()
}

pub fn parse_exercise(block: &str) -> Option<Value> {
    let first = block.lines().next()?.trim();
    let typ = first.strip_prefix('[')?.strip_suffix(']')?.to_string();
    let rest: Vec<String> = block
        .lines()
        .skip(1)
        .map(|l| l.trim().to_string())
        .collect();
    let field = |key: &str| -> Option<String> {
        rest.iter()
            .find_map(|line| line.strip_prefix(&format!("{key}:")))
            .map(clean)
    };
    let quoted_list = |prefix: Option<&str>| -> Vec<String> {
        rest.iter()
            .filter(|l| prefix.map(|p| l.starts_with(p)).unwrap_or(true))
            .flat_map(|line| quoted_values(line))
            .collect()
    };
    let srs_words = field("srsWords").unwrap_or_default();

    Some(match typ.as_str() {
        "multiple-choice" => {
            let mut choices = vec![];
            let mut correct_index = 0;
            for line in rest.iter().filter(|l| l.starts_with("- \"")) {
                let vals = quoted_values(line);
                if let Some(choice) = vals.first() {
                    if line.contains("(correct)") {
                        correct_index = choices.len();
                    }
                    choices.push(choice.clone());
                }
            }
            json!({ "type": typ, "text": field("text").unwrap_or_default(), "choices": choices, "correctIndex": correct_index, "srsWords": srs_words })
        }
        "translation" => {
            json!({ "type": typ, "text": field("text").unwrap_or_default(), "sentence": field("sentence").unwrap_or_default(), "answer": field("answer").unwrap_or_default(), "acceptAlso": quoted_list(Some("acceptAlso:")), "srsWords": srs_words })
        }
        "fill-in-the-blank" => {
            json!({ "type": typ, "sentence": field("sentence").unwrap_or_default(), "blank": field("blank").unwrap_or_default(), "srsWords": srs_words })
        }
        "matching-pairs" => {
            let pairs: Vec<_> = rest
                .iter()
                .filter(|l| l.starts_with("- "))
                .filter_map(|line| {
                    let vals = quoted_values(line);
                    (vals.len() >= 2).then(|| json!({ "left": vals[0], "right": vals[1] }))
                })
                .collect();
            json!({ "type": typ, "pairs": pairs, "srsWords": srs_words })
        }
        "listening" => {
            json!({ "type": typ, "text": field("text").unwrap_or_default(), "ttsLang": field("ttsLang").unwrap_or_default(), "mode": field("mode"), "choices": quoted_list(Some("- \"")), "correctIndex": 0, "srsWords": srs_words })
        }
        "word-bank" => {
            json!({ "type": typ, "text": field("text").unwrap_or_default(), "words": quoted_list(Some("words:")), "answer": quoted_list(Some("answer:")), "srsWords": srs_words })
        }
        "speaking" => {
            json!({ "type": typ, "sentence": field("sentence").unwrap_or_default(), "srsWords": srs_words })
        }
        "free-text" => {
            json!({ "type": typ, "text": field("text").unwrap_or_default(), "afterSubmitPrompt": field("afterSubmitPrompt").unwrap_or_default(), "srsWords": srs_words })
        }
        "flashcard-review" => {
            json!({ "type": typ, "front": field("front").unwrap_or_default(), "back": field("back").unwrap_or_default(), "srsWords": srs_words })
        }
        _ => json!({ "type": typ, "raw": block }),
    })
}

fn clean(value: &str) -> String {
    value
        .trim()
        .trim_matches('"')
        .trim()
        .trim_end_matches(" [no-audio]")
        .to_string()
}

fn quoted_values(line: &str) -> Vec<String> {
    let re = Regex::new(r#""([^"]+)""#).unwrap();
    re.captures_iter(line)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

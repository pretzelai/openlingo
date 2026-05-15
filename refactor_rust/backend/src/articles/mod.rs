pub mod jobs;

use regex::Regex;

pub fn count_words(text: &str) -> usize {
    text.split_whitespace().filter(|w| !w.is_empty()).count()
}

pub fn html_to_text(html: &str) -> String {
    let no_script = Regex::new(r"(?is)<(script|style|noscript)[^>]*>.*?</(script|style|noscript)>")
        .unwrap()
        .replace_all(html, " ");
    let no_tags = Regex::new(r"(?is)<[^>]+>")
        .unwrap()
        .replace_all(&no_script, " ");
    no_tags
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn chunks(text: &str) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    if words.is_empty() {
        return vec![];
    }
    words.chunks(220).map(|c| c.join(" ")).collect()
}

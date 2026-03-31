export async function getGitHubStars(): Promise<number | null> {
  try {
    const response = await fetch("https://api.github.com/repos/pretzelai/openlingo");
    if (!response.ok) return null;
    const data = (await response.json()) as { stargazers_count?: number };
    return data.stargazers_count ?? null;
  } catch {
    return null;
  }
}

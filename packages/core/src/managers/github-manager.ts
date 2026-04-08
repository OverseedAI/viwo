import { getGitHubToken } from './config-manager';

const GITHUB_ISSUE_URL_REGEX = /https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/g;

export interface GitHubIssue {
    owner: string;
    repo: string;
    number: number;
    title: string;
    body: string | null;
    state: string;
    labels: string[];
    comments: GitHubComment[];
}

export interface GitHubComment {
    author: string;
    body: string;
    createdAt: string;
}

interface ParsedIssueUrl {
    owner: string;
    repo: string;
    number: number;
    fullUrl: string;
}

const MAX_COMMENTS = 25;

export const parseIssueUrls = (text: string): ParsedIssueUrl[] => {
    const matches: ParsedIssueUrl[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(GITHUB_ISSUE_URL_REGEX)) {
        const key = `${match[1]}/${match[2]}#${match[3]}`;
        if (seen.has(key)) continue;
        seen.add(key);

        matches.push({
            owner: match[1]!,
            repo: match[2]!,
            number: parseInt(match[3]!, 10),
            fullUrl: match[0],
        });
    }

    return matches;
};

const fetchJson = async (url: string, token: string): Promise<any> => {
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });

    if (response.status === 401) {
        throw new Error(
            'GitHub token is invalid or expired. Run "viwo config github" to update it.'
        );
    }

    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
};

export const fetchIssue = async (options: {
    owner: string;
    repo: string;
    number: number;
    token: string;
}): Promise<GitHubIssue> => {
    const { owner, repo, number, token } = options;
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;

    const [issueData, commentsData] = await Promise.all([
        fetchJson(baseUrl, token),
        fetchJson(`${baseUrl}/comments?per_page=${MAX_COMMENTS}`, token),
    ]);

    return {
        owner,
        repo,
        number,
        title: issueData.title,
        body: issueData.body,
        state: issueData.state,
        labels: (issueData.labels ?? []).map((l: any) => (typeof l === 'string' ? l : l.name)),
        comments: (commentsData ?? []).map((c: any) => ({
            author: c.user?.login ?? 'unknown',
            body: c.body ?? '',
            createdAt: c.created_at,
        })),
    };
};

const formatIssue = (issue: GitHubIssue): string => {
    const parts: string[] = [];

    parts.push(`## GitHub Issue #${issue.number}: ${issue.title}`);
    parts.push(`**Repository:** ${issue.owner}/${issue.repo}`);
    parts.push(`**State:** ${issue.state}`);

    if (issue.labels.length > 0) {
        parts.push(`**Labels:** ${issue.labels.join(', ')}`);
    }

    if (issue.body) {
        parts.push('');
        parts.push(issue.body);
    }

    if (issue.comments.length > 0) {
        parts.push('');
        parts.push('### Comments');

        for (const comment of issue.comments) {
            parts.push('');
            parts.push(`**@${comment.author}** (${comment.createdAt}):`);
            parts.push(comment.body);
        }
    }

    return parts.join('\n');
};

export const expandPromptWithIssues = async (prompt: string): Promise<string> => {
    const issueUrls = parseIssueUrls(prompt);
    if (issueUrls.length === 0) return prompt;

    const token = getGitHubToken();
    if (!token) return prompt;

    const issues = await Promise.all(
        issueUrls.map((url) =>
            fetchIssue({ owner: url.owner, repo: url.repo, number: url.number, token })
        )
    );

    let expandedPrompt = prompt;
    for (let i = 0; i < issueUrls.length; i++) {
        expandedPrompt = expandedPrompt.replace(issueUrls[i]!.fullUrl, formatIssue(issues[i]!));
    }

    return expandedPrompt;
};

// ─── Token Resolution ──────────────────────────────────────────────────────

export const resolveGitHubTokenFromGhCli = async (): Promise<string | null> => {
    try {
        const proc = Bun.spawn(['gh', 'auth', 'token'], { stdout: 'pipe', stderr: 'pipe' });
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        if (exitCode === 0 && output.trim()) {
            return output.trim();
        }
    } catch {
        // gh not installed or not authed
    }

    return null;
};

export const resolveGitHubTokenFromEnv = (): string | null => {
    return process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
};

export const github = {
    parseIssueUrls,
    fetchIssue,
    expandPromptWithIssues,
    resolveGitHubTokenFromGhCli,
    resolveGitHubTokenFromEnv,
};

import { getGitLabInstanceUrl, getGitLabToken } from './config-manager';

const DEFAULT_GITLAB_INSTANCE_URL = 'https://gitlab.com';
const MAX_COMMENTS = 25;

export interface GitLabComment {
    author: string;
    body: string;
    createdAt: string;
}

export interface GitLabResource {
    instanceUrl: string;
    projectPath: string;
    kind: 'issue' | 'merge_request';
    number: number;
    title: string;
    body: string | null;
    state: string;
    labels: string[];
    comments: GitLabComment[];
}

export interface ParsedGitLabResourceUrl {
    instanceUrl: string;
    projectPath: string;
    kind: 'issue' | 'merge_request';
    number: number;
    fullUrl: string;
}

const normalizeInstanceUrl = (instanceUrl: string | null | undefined): string => {
    if (!instanceUrl) return DEFAULT_GITLAB_INSTANCE_URL;

    const trimmed = instanceUrl.trim();
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return withProtocol.replace(/\/+$/, '');
};

const escapeRegex = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getSupportedHosts = (): string[] => {
    const configuredInstanceUrl = getGitLabInstanceUrl();
    const configuredHost = new URL(normalizeInstanceUrl(configuredInstanceUrl)).host;
    return Array.from(new Set(['gitlab.com', configuredHost]));
};

export const getGitLabApiBaseUrl = (): string => {
    return `${normalizeInstanceUrl(getGitLabInstanceUrl())}/api/v4`;
};

export const getGitLabInstanceBaseUrl = (): string => {
    return normalizeInstanceUrl(getGitLabInstanceUrl());
};

export const parseGitLabResourceUrls = (text: string): ParsedGitLabResourceUrl[] => {
    const hosts = getSupportedHosts();
    const hostPattern = hosts.map(escapeRegex).join('|');
    const regex = new RegExp(
        `https?:\\/\\/(${hostPattern})\\/((?:[^/]+\\/)+[^/]+)\\/-\\/(issues|merge_requests)\\/(\\d+)`,
        'g'
    );

    const matches: ParsedGitLabResourceUrl[] = [];
    const seen = new Set<string>();

    for (const match of text.matchAll(regex)) {
        const host = match[1]!;
        const projectPath = match[2]!;
        const resourceType = match[3]!;
        const number = parseInt(match[4]!, 10);
        const kind = resourceType === 'merge_requests' ? 'merge_request' : 'issue';
        const key = `${host}/${projectPath}/${kind}#${number}`;

        if (seen.has(key)) continue;
        seen.add(key);

        matches.push({
            instanceUrl: `https://${host}`,
            projectPath,
            kind,
            number,
            fullUrl: match[0],
        });
    }

    return matches;
};

const fetchJson = async (url: string, token: string): Promise<any> => {
    const response = await fetch(url, {
        headers: {
            'PRIVATE-TOKEN': token,
            Accept: 'application/json',
        },
    });

    if (response.status === 401) {
        throw new Error(
            'GitLab token is invalid or expired. Run "viwo config gitlab" to update it.'
        );
    }

    if (!response.ok) {
        throw new Error(`GitLab API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
};

export const fetchGitLabResource = async (options: {
    instanceUrl: string;
    projectPath: string;
    kind: 'issue' | 'merge_request';
    number: number;
    token: string;
}): Promise<GitLabResource> => {
    const { instanceUrl, projectPath, kind, number, token } = options;
    const normalizedInstanceUrl = normalizeInstanceUrl(instanceUrl);
    const apiBaseUrl = `${normalizedInstanceUrl}/api/v4/projects/${encodeURIComponent(projectPath)}`;
    const resourcePath = kind === 'issue' ? 'issues' : 'merge_requests';
    const notesPath = kind === 'issue' ? 'notes' : 'notes';
    const baseUrl = `${apiBaseUrl}/${resourcePath}/${number}`;

    const [resourceData, commentsData] = await Promise.all([
        fetchJson(baseUrl, token),
        fetchJson(`${baseUrl}/${notesPath}?per_page=${MAX_COMMENTS}`, token),
    ]);

    return {
        instanceUrl: normalizedInstanceUrl,
        projectPath,
        kind,
        number,
        title: resourceData.title,
        body: resourceData.description ?? null,
        state: resourceData.state,
        labels: resourceData.labels ?? [],
        comments: (commentsData ?? []).map((comment: any) => ({
            author: comment.author?.username ?? comment.author?.name ?? 'unknown',
            body: comment.body ?? '',
            createdAt: comment.created_at,
        })),
    };
};

const formatGitLabResource = (resource: GitLabResource): string => {
    const parts: string[] = [];
    const resourceName = resource.kind === 'issue' ? 'Issue' : 'Merge Request';

    parts.push(`## GitLab ${resourceName} #${resource.number}: ${resource.title}`);
    parts.push(`**Project:** ${resource.projectPath}`);
    parts.push(`**Instance:** ${resource.instanceUrl}`);
    parts.push(`**State:** ${resource.state}`);

    if (resource.labels.length > 0) {
        parts.push(`**Labels:** ${resource.labels.join(', ')}`);
    }

    if (resource.body) {
        parts.push('');
        parts.push(resource.body);
    }

    if (resource.comments.length > 0) {
        parts.push('');
        parts.push('### Comments');

        for (const comment of resource.comments) {
            parts.push('');
            parts.push(`**@${comment.author}** (${comment.createdAt}):`);
            parts.push(comment.body);
        }
    }

    return parts.join('\n');
};

export const expandPromptWithGitLabResources = async (prompt: string): Promise<string> => {
    const resourceUrls = parseGitLabResourceUrls(prompt);
    if (resourceUrls.length === 0) return prompt;

    const token = getGitLabToken();
    if (!token) return prompt;

    const resources = await Promise.all(
        resourceUrls.map((resourceUrl) =>
            fetchGitLabResource({
                instanceUrl: resourceUrl.instanceUrl,
                projectPath: resourceUrl.projectPath,
                kind: resourceUrl.kind,
                number: resourceUrl.number,
                token,
            })
        )
    );

    let expandedPrompt = prompt;
    for (let i = 0; i < resourceUrls.length; i++) {
        expandedPrompt = expandedPrompt.replace(
            resourceUrls[i]!.fullUrl,
            formatGitLabResource(resources[i]!)
        );
    }

    return expandedPrompt;
};

export const resolveGitLabTokenFromGlabCli = async (): Promise<string | null> => {
    const configuredHost = new URL(getGitLabInstanceBaseUrl()).host;
    const commands = configuredHost === 'gitlab.com'
        ? [['glab', 'auth', 'token'], ['glab', 'auth', 'token', '--hostname', configuredHost]]
        : [['glab', 'auth', 'token', '--hostname', configuredHost], ['glab', 'auth', 'token']];

    for (const command of commands) {
        try {
            const proc = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' });
            const output = await new Response(proc.stdout).text();
            const exitCode = await proc.exited;

            if (exitCode === 0 && output.trim()) {
                return output.trim();
            }
        } catch {
            // glab not installed or not authed
        }
    }

    return null;
};

export const resolveGitLabTokenFromEnv = (): string | null => {
    return process.env.GITLAB_TOKEN ?? null;
};

export const gitlab = {
    getGitLabApiBaseUrl,
    getGitLabInstanceBaseUrl,
    parseGitLabResourceUrls,
    fetchGitLabResource,
    expandPromptWithGitLabResources,
    resolveGitLabTokenFromGlabCli,
    resolveGitLabTokenFromEnv,
};

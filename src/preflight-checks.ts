import { execSync } from 'child_process';

export interface PreflightResult {
  success: boolean;
  error?: string;
}

export async function checkDockerCLI(): Promise<PreflightResult> {
  try {
    execSync('docker --version', { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        'Docker CLI is not installed. Please install Docker Desktop or Docker Engine.',
    };
  }
}

export async function checkDockerEngine(): Promise<PreflightResult> {
  try {
    execSync('docker info', { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        'Docker Engine is not running. Please start Docker Desktop or Docker daemon.',
    };
  }
}

export async function checkGitCLI(): Promise<PreflightResult> {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: 'Git CLI is not installed. Please install Git.',
    };
  }
}

export async function runPreflightChecks(): Promise<PreflightResult> {
  const cliCheck = await checkDockerCLI();
  if (!cliCheck.success) {
    return cliCheck;
  }

  const engineCheck = await checkDockerEngine();
  if (!engineCheck.success) {
    return engineCheck;
  }

  const gitCheck = await checkGitCLI();
  if (!gitCheck.success) {
    return gitCheck;
  }

  return { success: true };
}

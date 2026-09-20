interface ReleaseIdentity { version: string; build: number; commit: string; dirty: boolean; builtAt: string }
declare const __AINKRAD_RELEASE__: ReleaseIdentity;
export const RELEASE = __AINKRAD_RELEASE__;
export const RELEASE_LABEL = `v${RELEASE.version} · сборка ${RELEASE.build} · ${RELEASE.commit.slice(0, 7)}${RELEASE.dirty ? '*' : ''}`;

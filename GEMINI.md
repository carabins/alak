# Gemini Added Memories
- Videoroll uses async-ads library as an embedded core served as base64 string from the server. The architecture involves reactive atoms (alak) and entity/sensor system (lasens).
- Package management: Do NOT create `package.json` or `tsconfig.json` in packages. They are generated automatically. Use `package.yaml` instead (similar to `@packages/quark/package.yaml`).
- Testing: Run tests via `bun test ./packages/<package_name>/test/`.
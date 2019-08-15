import {
    cachedProcessFile,
    createMinimalFS,
    Diagnostics,
    FileProcessor,
    postProcessor,
    process,
    processNamespace,
    replaceValueHook,
    Stylable,
    StylableMeta,
    StylableResolver,
    StylableResults,
    StylableTransformer
} from '@stylable/core';
import { isAbsolute } from 'path';
import postcss from 'postcss';


export interface File {
    content: string;
    mtime?: Date;
    namespace?: string;
}

export interface InfraConfig {
    files: Record<string, File>;
    trimWS?: boolean;
}

export interface Config {
    entry?: string;
    files: Record<string, File>;
    usedFiles?: string[];
    trimWS?: boolean;
    optimize?: boolean;
    resolve?: any;
    mode?: 'production' | 'development';
}

export type RequireType = (path: string) => any;

export function generateInfra(
    config: InfraConfig,
    diagnostics: Diagnostics = new Diagnostics()
): {
    resolver: StylableResolver;
    requireModule: RequireType;
    fileProcessor: FileProcessor<StylableMeta>;
} {
    const { fs, requireModule, resolveFrom } = createMinimalFS(config);

    const fileProcessor = cachedProcessFile<StylableMeta>(
        (from, content) => {

            
            const parsedAST = postcss.parse(content, { from });

            if (from && parsedAST.source) {
                const { input } = parsedAST.source;
        
                // postcss runs path.resolve, which messes up posix style paths when running on windows
                Object.defineProperty(input, 'from', { value: from });
                parsedAST.source.input.file = from;
            }
            
            const meta = process(parsedAST, diagnostics);
            meta.namespace = config.files[from].namespace || meta.namespace;
            return meta;
        },
        fs,
        resolveFrom
    );

    const resolver = new StylableResolver(fileProcessor, requireModule);

    return { resolver, requireModule, fileProcessor };
}

export function createTransformer(
    config: Config,
    diagnostics: Diagnostics = new Diagnostics(),
    replaceValueHook?: replaceValueHook,
    postProcessor?: postProcessor
): StylableTransformer {
    const { requireModule, fileProcessor, resolver } = generateInfra(config, diagnostics);

    return new StylableTransformer({
        fileProcessor,
        requireModule,
        diagnostics,
        keepValues: false,
        replaceValueHook,
        postProcessor,
        mode: config.mode,
        resolver
    });
}

export function processSource(
    source: string,
    options: { from: string } = { from: '/entry.st.css' },
    resolveNamespace?: typeof processNamespace
) {
    const parsedAST = postcss.parse(source, options);
    if (options.from && parsedAST.source) {
        const { input } = parsedAST.source;

        // postcss runs path.resolve, which messes up posix style paths when running on windows
        Object.defineProperty(input, 'from', { value: options.from });
        parsedAST.source.input.file = options.from;
    }

    return process(parsedAST, undefined, resolveNamespace);
}

export function generateFromMock(
    config: Config,
    diagnostics: Diagnostics = new Diagnostics()
): StylableResults {
    if (!isAbsolute(config.entry || '')) {
        throw new Error('entry must be absolute path: ' + config.entry);
    }
    const entry = config.entry;

    const t = createTransformer(config, diagnostics);

    const result = t.transform(t.fileProcessor.process(entry || ''));

    return result;
}

export function createProcess(
    fileProcessor: FileProcessor<StylableMeta>
): (path: string) => StylableMeta {
    return (path: string) => fileProcessor.process(path);
}

export function generateStylableResult(config: Config) {
    return generateFromMock(config);
}

export function generateStylableRoot(config: Config) {
    return generateFromMock(config).meta.outputAst!;
}

export function generateStylableExports(config: Config) {
    return generateFromMock(config).exports;
}

export function createStylableInstance(config: Config) {
    config.trimWS = true;

    const { fs, requireModule } = createMinimalFS(config);

    const stylable = new Stylable(
        '/',
        fs as any,
        requireModule,
        '__',
        (meta, path) => {
            meta.namespace = config.files[path].namespace || meta.namespace;
            return meta;
        },
        undefined,
        undefined,
        config.resolve
    );

    return stylable;
}

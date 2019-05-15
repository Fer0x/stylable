import { Stylable } from '@stylable/core';
import { functionWarnings, processorWarnings, resolverWarnings } from '@stylable/core';
import { createMemoryFileSystemWithFiles as createFS } from '@stylable/e2e-test-kit';
import { expect } from 'chai';
import * as path from 'path';
import { build } from '../src';

const log = () => {
    /**/
};

describe('build stand alone', () => {
    it('should create modules and copy source css files', () => {
        const fs = createFS({
            '/main.st.css': `
                :import{
                    -st-from: "./components/comp.st.css";
                    -st-default:Comp;
                }
                .gaga{
                    -st-extends:Comp;
                    color:blue;
                }
            `,
            '/components/comp.st.css': `
                .baga{
                    color:red;
                }
            `
        });

        const stylable = new Stylable('/', fs as any, () => ({}));

        build({
            extension: '.st.css',
            fs: fs as any,
            stylable,
            outDir: 'lib',
            srcDir: '.',
            rootDir: path.resolve('/'),
            log,
            moduleFormats: ['cjs']
        });

        [
            '/lib/main.st.css',
            '/lib/main.st.css.js',
            '/lib/components/comp.st.css',
            '/lib/components/comp.st.css.js'
        ].forEach(p => {
            expect(fs.existsSync(path.resolve(p)), p).to.equal(true);
        });

        // assure no index file was generated by default
        expect(fs.existsSync(path.resolve('/lib/index.st.css')), '/lib/index.st.css').to.equal(false);
    });

    it('should report errors originating from stylable (process + transform)', async () => {
        const fs = createFS({
            '/comp.st.css': `
                :import {
                    -st-from: "./missing-file.st.css"
                    -st-default: OtherMissingComp;
                }

                .a {
                    -st-extends: MissingComp;
                    color: value(missingVar);
                }
            `
        });

        const stylable = new Stylable('/', fs as any, () => ({}));
        let reportedError = '';

        await build({
            extension: '.st.css',
            fs: fs as any,
            stylable,
            outDir: '.',
            srcDir: '.',
            rootDir: path.resolve('/'),
            log,
            diagnostics: (...args: string[]) => ([reportedError] = args),
            moduleFormats: ['cjs']
        });

        expect(reportedError).to.contain(processorWarnings.CANNOT_RESOLVE_EXTEND('MissingComp'));
        expect(reportedError).to.contain(functionWarnings.UNKNOWN_VAR('missingVar'));
        expect(reportedError).to.contain(
            resolverWarnings.UNKNOWN_IMPORTED_FILE('./missing-file.st.css')
        );
    });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUrlState } from '../src/js/url-state.mjs';

test('parses an empty URL state', () => {
    assert.deepEqual(parseUrlState(''), {
        toolkitId: null,
        study: null,
        accessions: null,
        error: null,
    });
});

test('parses study-only links', () => {
    assert.deepEqual(parseUrlState('?study=Banana'), {
        toolkitId: null,
        study: 'Banana',
        accessions: null,
        error: null,
    });
});

test('decodes and preserves ordered CSV accessions', () => {
    assert.deepEqual(parseUrlState('?study=Banana&accessions=e-ventricosum%2Ce-glaucum'), {
        toolkitId: null,
        study: 'Banana',
        accessions: ['e-ventricosum', 'e-glaucum'],
        error: null,
    });
});

test('trims id and study while preserving the first existing parameter value', () => {
    assert.deepEqual(parseUrlState('?id=%20toolkit_example%20&id=ignored&study=%20Banana%20'), {
        toolkitId: 'toolkit_example',
        study: 'Banana',
        accessions: null,
        error: null,
    });
});

test('reports missing study before accession content errors', () => {
    assert.equal(parseUrlState('?accessions=a,b').error.code, 'MISSING_STUDY');
});

test('reports too few accessions', () => {
    assert.equal(parseUrlState('?study=Banana&accessions=a').error.code, 'TOO_FEW_ACCESSIONS');
});

test('reports empty accessions', () => {
    assert.equal(parseUrlState('?study=Banana&accessions=a,,b').error.code, 'EMPTY_ACCESSION');
});

test('reports invalid accession characters', () => {
    assert.equal(parseUrlState('?study=Banana&accessions=a,b%2Fc').error.code, 'INVALID_ACCESSION');
});

test('reports duplicate accessions using exact case-sensitive equality', () => {
    assert.equal(parseUrlState('?study=Banana&accessions=a,A').error, null);
    assert.equal(parseUrlState('?study=Banana&accessions=a,a').error.code, 'DUPLICATE_ACCESSION');
});

test('reports repeated accessions parameters', () => {
    assert.equal(parseUrlState('?study=Banana&accessions=a,b&accessions=c,d').error.code, 'MULTIPLE_ACCESSIONS_PARAMS');
});

test('retains toolkit id alongside a visualization request', () => {
    assert.deepEqual(parseUrlState('?id=toolkit_example&study=Banana&accessions=a,b'), {
        toolkitId: 'toolkit_example',
        study: 'Banana',
        accessions: ['a', 'b'],
        error: null,
    });
});

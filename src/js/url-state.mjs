const ERROR_MESSAGES = {
    MULTIPLE_ACCESSIONS_PARAMS: 'The "accessions" URL parameter must be provided only once.',
    MISSING_STUDY: 'The "accessions" URL parameter requires a non-empty "study" parameter.',
    EMPTY_ACCESSION: 'The "accessions" URL parameter contains an empty accession identifier.',
    TOO_FEW_ACCESSIONS: 'The "accessions" URL parameter must contain at least two accession identifiers.',
    INVALID_ACCESSION: 'Accession identifiers may contain only letters, numbers, ".", "_" and "-".',
    DUPLICATE_ACCESSION: 'The "accessions" URL parameter contains duplicate accession identifiers.',
};

function error(code) {
    return { code, message: ERROR_MESSAGES[code] };
}

function firstTrimmedValue(params, name) {
    const value = params.get(name);
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed || null;
}

export function parseUrlState(search) {
    const params = new URLSearchParams(search);
    const toolkitId = firstTrimmedValue(params, 'id');
    const study = firstTrimmedValue(params, 'study');
    const accessionsValues = params.getAll('accessions');

    if (accessionsValues.length === 0) {
        return { toolkitId, study, accessions: null, error: null };
    }

    if (accessionsValues.length > 1) {
        return {
            toolkitId,
            study,
            accessions: null,
            error: error('MULTIPLE_ACCESSIONS_PARAMS'),
        };
    }

    if (!study) {
        return {
            toolkitId,
            study,
            accessions: null,
            error: error('MISSING_STUDY'),
        };
    }

    const accessions = accessionsValues[0].split(',').map((accession) => accession.trim());
    if (accessions.some((accession) => accession.length === 0)) {
        return {
            toolkitId,
            study,
            accessions: null,
            error: error('EMPTY_ACCESSION'),
        };
    }

    if (accessions.length < 2) {
        return {
            toolkitId,
            study,
            accessions: null,
            error: error('TOO_FEW_ACCESSIONS'),
        };
    }

    if (accessions.some((accession) => !/^[A-Za-z0-9._-]+$/.test(accession))) {
        return {
            toolkitId,
            study,
            accessions: null,
            error: error('INVALID_ACCESSION'),
        };
    }

    if (new Set(accessions).size !== accessions.length) {
        return {
            toolkitId,
            study,
            accessions: null,
            error: error('DUPLICATE_ACCESSION'),
        };
    }

    return { toolkitId, study, accessions, error: null };
}

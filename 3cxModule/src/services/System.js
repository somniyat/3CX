/**
 * Service de recuperation des informations systeme et extensions via XAPI.
 */

/**
 * Recuperer la liste des utilisateurs/extensions.
 * Endpoint : GET /xapi/v1/Users
 */
async function getExtensions(http) {
    const { data } = await http.get('/xapi/v1/Users', {
        params: { $select: 'Id,Number,FirstName,LastName,EmailAddress', $count: true },
    });

    return (data.value || []).map((u) => ({
        id: u.Id?.toString() || '',
        number: u.Number || '',
        name: [u.FirstName, u.LastName].filter(Boolean).join(' ') || u.Number || '',
        email: u.EmailAddress || '',
        status: 'unknown',
    }));
}

/**
 * Recuperer le statut du systeme 3CX.
 * Endpoint : GET /xapi/v1/SystemStatus
 */
async function getSystemStatus(http) {
    const { data } = await http.get('/xapi/v1/SystemStatus');

    return {
        fqdn: data.FQDN || '',
        version: data.Version || '',
        activated: data.Activated ?? false,
        extensionsRegistered: data.ExtensionsRegistered ?? 0,
        extensionsTotal: data.ExtensionsTotal ?? 0,
        trunksRegistered: data.TrunksRegistered ?? 0,
        trunksTotal: data.TrunksTotal ?? 0,
        callsActive: data.CallsActive ?? 0,
        maxSimCalls: data.MaxSimCalls ?? 0,
        ip: data.Ip || '',
        diskUsage: data.DiskUsage ?? 0,
        freeDiskSpace: data.FreeDiskSpace ?? 0,
        totalDiskSpace: data.TotalDiskSpace ?? 0,
        maintenanceExpiresAt: data.MaintenanceExpiresAt || '',
    };
}

/**
 * Recuperer la liste des appels actifs.
 * Endpoint : GET /xapi/v1/ActiveCalls
 */
async function getActiveCalls(http) {
    const { data } = await http.get('/xapi/v1/ActiveCalls', {
        params: { $count: true, $orderby: 'EstablishedAt desc' },
    });

    return (data.value || []).map((c) => ({
        id: c.Id?.toString() || '',
        caller: c.Caller || '',
        callee: c.Callee || '',
        status: c.Status || '',
        establishedAt: c.EstablishedAt || '',
        lastChangeStatus: c.LastChangeStatus || '',
    }));
}

/**
 * Lister les utilisateurs avec pagination, recherche et filtre.
 * Endpoint : GET /xapi/v1/Users
 */
async function listUsers(http, options = {}) {
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize || 50));

    const params = {
        $select: 'Id,Number,FirstName,LastName,EmailAddress,Mobile,Enabled,Internal',
        $orderby: 'Number',
        $top: pageSize,
        $skip: (page - 1) * pageSize,
        $count: true,
    };

    const filters = [];

    if (options.enabledOnly) {
        filters.push('Enabled eq true');
    }

    if (options.search && options.search.trim()) {
        const q = options.search.trim().replace(/'/g, "''");
        filters.push(
            `(contains(FirstName,'${q}') or contains(LastName,'${q}') or startswith(Number,'${q}') or contains(EmailAddress,'${q}'))`
        );
    }

    if (filters.length) {
        params.$filter = filters.join(' and ');
    }

    const { data } = await http.get('/xapi/v1/Users', { params });

    const total = data['@odata.count'] ?? 0;
    const items = (data.value || []).map(normalizeUser);

    return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
    };
}

function normalizeUser(raw) {
    return {
        id: raw.Id ?? 0,
        extension: raw.Number || '',
        fullName: [raw.FirstName, raw.LastName].filter(Boolean).join(' ').trim(),
        firstName: raw.FirstName || '',
        lastName: raw.LastName || '',
        email: raw.EmailAddress || null,
        mobile: raw.Mobile || null,
        enabled: raw.Enabled ?? true,
        internal: raw.Internal ?? true,
    };
}

module.exports = { getExtensions, getSystemStatus, getActiveCalls, listUsers };

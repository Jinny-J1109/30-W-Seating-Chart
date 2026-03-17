const fs = require('fs');
const path = require('path');

const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SHAREPOINT_HOST = 'smithgill.sharepoint.com';
const SITE_PATH = '/sites/ASGGIntranet';

async function getToken() {
  const res = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope: 'https://graph.microsoft.com/.default'
      })
    }
  );
  const data = await res.json();
  return data.access_token;
}

async function getGroupId(token) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/groups?$filter=displayName eq 'Fortigate-VPN-Users'&$select=id`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (!data.value || data.value.length === 0) throw new Error('Group "Fortigate-VPN-Users" not found');
  return data.value[0].id;
}

async function getGroupMembers(token, groupId) {
  const users = [];
  let url = `https://graph.microsoft.com/v1.0/groups/${groupId}/members?$select=id,displayName,jobTitle,mail,userPrincipalName&$top=999`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    users.push(...(data.value || []));
    url = data['@odata.nextLink'] || null;
  }

  return users;
}

function loadFileOverrides() {
  try {
    const filePath = path.join(__dirname, 'overrides.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const list = JSON.parse(raw);
    const map = {};
    list.forEach(emp => {
      const key = emp.name.toLowerCase().trim();
      map[key] = {
        profileUrl: emp.profileUrl || '',
        title: emp.title || '',
        email: emp.email || ''
      };
    });
    return map;
  } catch (e) {
    return {};
  }
}

async function loadSharePointOverrides(token) {
  try {
    const siteRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOST}:${SITE_PATH}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const siteId = (await siteRes.json()).id;
    const listUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/EmployeeOverrides`;
    const res = await fetch(`${listUrl}/items?$expand=fields&$select=fields&$top=999`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const map = {};
    (data.value || []).forEach(item => {
      const name = item.fields.Title;
      if (name) {
        map[name.toLowerCase().trim()] = {
          profileUrl: item.fields.ProfileURL || '',
          title: item.fields.JobTitle || '',
          email: item.fields.Email || ''
        };
      }
    });
    return map;
  } catch (e) {
    return {};
  }
}

module.exports = async function (context, req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers, body: '' };
    return;
  }

  try {
    const token = await getToken();
    const groupId = await getGroupId(token);
    const users = await getGroupMembers(token, groupId);
    const fileOverrides = loadFileOverrides();
    const spOverrides = await loadSharePointOverrides(token);
    // SharePoint overrides take priority over file overrides
    const overrides = { ...fileOverrides };
    for (const [key, val] of Object.entries(spOverrides)) {
      overrides[key] = { ...(overrides[key] || {}), ...val };
      // Only override non-empty values from SharePoint
      if (!val.profileUrl && overrides[key].profileUrl) overrides[key].profileUrl = fileOverrides[key]?.profileUrl || '';
      if (!val.title && overrides[key].title) overrides[key].title = fileOverrides[key]?.title || '';
    }

    const employees = users
      .filter(u => u.displayName && u.mail)
      .map(u => {
        const nameKey = u.displayName.toLowerCase().trim();
        const override = overrides[nameKey] || {};
        return {
          id: u.id,
          name: u.displayName,
          title: override.title || u.jobTitle || '',
          email: override.email || u.mail || u.userPrincipalName || '',
          profileUrl: override.profileUrl || ''
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    context.res = {
      status: 200,
      headers,
      body: JSON.stringify(employees)
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

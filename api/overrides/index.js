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

async function getSiteId(token) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${SHAREPOINT_HOST}:${SITE_PATH}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.id;
}

module.exports = async function (context, req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers, body: '' };
    return;
  }

  try {
    const token = await getToken();
    const siteId = await getSiteId(token);
    const listUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/EmployeeOverrides`;

    if (req.method === 'GET') {
      const res = await fetch(`${listUrl}/items?$expand=fields&$select=fields&$top=999`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      const overrides = {};
      (data.value || []).forEach(item => {
        const name = item.fields.Title;
        if (name) {
          overrides[name.toLowerCase().trim()] = {
            profileUrl: item.fields.ProfileURL || '',
            title: item.fields.JobTitle || '',
            email: item.fields.Email || ''
          };
        }
      });

      context.res = { status: 200, headers, body: JSON.stringify(overrides) };
      return;
    }

    if (req.method === 'POST') {
      const { name, profileUrl, title, email } = req.body;
      if (!name) {
        context.res = { status: 400, headers, body: JSON.stringify({ error: 'Name required' }) };
        return;
      }

      // Check if override already exists for this name
      const searchRes = await fetch(
        `${listUrl}/items?$expand=fields&$filter=fields/Title eq '${name.replace(/'/g, "''")}'`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const searchData = await searchRes.json();
      const existing = (searchData.value || [])[0];

      const fields = {
        Title: name,
        ProfileURL: profileUrl || '',
        JobTitle: title || '',
        Email: email || ''
      };

      if (existing) {
        // Update existing
        await fetch(`${listUrl}/items/${existing.id}/fields`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(fields)
        });
      } else {
        // Create new
        await fetch(`${listUrl}/items`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields })
        });
      }

      context.res = { status: 200, headers, body: JSON.stringify({ status: 'ok' }) };
      return;
    }

    context.res = { status: 405, headers, body: 'Method not allowed' };

  } catch (err) {
    context.res = { status: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

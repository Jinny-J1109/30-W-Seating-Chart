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
    const listUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/SeatingAssignments`;

    if (req.method === 'GET') {
      const res = await fetch(`${listUrl}/items?$expand=fields&$select=fields`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      const assignments = {};
      let lastUpdated = null;
      let lastUpdatedBy = null;
      (data.value || []).forEach(item => {
        const deskId = item.fields.DeskID || item.fields.Title;
        const empId = item.fields.EmployeeID;
        if (deskId === '_lastUpdated') {
          lastUpdated = empId;
        } else if (deskId === '_lastUpdatedBy') {
          lastUpdatedBy = empId;
        } else if (deskId && empId) {
          assignments[deskId] = empId;
        }
      });
      if (lastUpdated) assignments._lastUpdated = lastUpdated;
      if (lastUpdatedBy) assignments._lastUpdatedBy = lastUpdatedBy;

      context.res = { status: 200, headers, body: JSON.stringify(assignments) };
      return;
    }

    if (req.method === 'POST') {
      const newAssignments = req.body;

      const existingRes = await fetch(`${listUrl}/items?$select=id`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const existingData = await existingRes.json();
      for (const item of (existingData.value || [])) {
        await fetch(`${listUrl}/items/${item.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      for (const [deskId, empId] of Object.entries(newAssignments)) {
        await fetch(`${listUrl}/items`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fields: { Title: deskId, EmployeeID: empId } })
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

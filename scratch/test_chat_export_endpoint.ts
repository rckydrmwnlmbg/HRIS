async function testExportEndpoint() {
  const sql = `
    SELECT TOP 5 
      RTRIM(s.SEC_DESC) AS LINE_PRODUKSI,
      COUNT(e.EMP_CD) AS JUMLAH_KARYAWAN
    FROM EMP_TABLE e
    JOIN MS_SEC s ON RTRIM(e.SEC_CD) = RTRIM(s.SEC_CD)
    WHERE e.Act_NonAct = 1 AND (e.DT_RSG IS NULL OR e.DT_RSG >= GETDATE())
    GROUP BY s.SEC_DESC
    ORDER BY JUMLAH_KARYAWAN DESC
  `;

  console.log('Sending export request to http://localhost:3000/api/chat/export...');
  const res = await fetch('http://localhost:3000/api/chat/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, title: 'Rekap Karyawan Line Produksi' }),
  });

  console.log('Response Status:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
  console.log('Content-Disposition:', res.headers.get('content-disposition'));

  if (res.ok) {
    const arrayBuffer = await res.arrayBuffer();
    console.log(`Successfully received Excel binary buffer (${arrayBuffer.byteLength} bytes)`);
  } else {
    const err = await res.json();
    console.error('Export error:', err);
  }
}

testExportEndpoint();

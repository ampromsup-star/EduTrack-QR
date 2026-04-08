const API = "YOUR_WEB_APP_URL";

// ================= API =================
async function api(action,data={}){
  const res = await fetch(API,{
    method:'POST',
    body: JSON.stringify({action,data})
  });
  return res.json();
}

// ================= SCANNER =================
if(document.getElementById("reader")){
  const scanner = new Html5Qrcode("reader");

  scanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    async (decoded) => {
      let res = await api('scanQR',{id:decoded,type:'มา'});
      alert("✔ "+res.name);
    }
  );
}

// ================= DASHBOARD =================
if(document.getElementById("chart")){
  loadChart();
}

async function loadChart(){
  const res = await api('getDashboard');

  new Chart(document.getElementById("chart"),{
    type:'doughnut',
    data:{
      labels:Object.keys(res.stats),
      datasets:[{data:Object.values(res.stats)}]
    }
  });
}

// ================= ADD STUDENT =================
async function addStudent(){
  await api('addStudent',{
    id:document.getElementById('id').value,
    name:document.getElementById('name').value,
    class:'ปวช.1/1'
  });
  alert("เพิ่มแล้ว");
}

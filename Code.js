const SS_ID = '1IgJA4QnGSYsFhnnfR1O8udQqgWX5LxmkEJfXWoHw9UE';

// 0. ฟังก์ชันเข้าถึง Sheet แบบปลอดภัย
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet && name === 'Attendance') {
    sheet = ss.insertSheet('Attendance');
    sheet.appendRow(['วันที่', 'รหัส', 'ชื่อ', 'ห้อง', 'สถานะ', 'เวลา']);
  }
  return sheet;
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('EduTrack QR - Login')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 1. ระบบ Login
function checkLogin(username, password) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    // เทียบ Username (หลัก 5) และ Password (หลัก 6)
    if (String(data[i][4]) === String(username) && String(data[i][5]) === String(password)) {
      return { 
        status: "success", 
        userId: data[i][0], 
        name: data[i][1], 
        role: data[i][2], 
        class: data[i][3] 
      };
    }
  }
  return { status: "error", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
}

// 2. จัดการห้องเรียน
function manageRoom(action, data) {
  const sheet = getSheet('Rooms');
  const values = sheet.getDataRange().getValues();

  if (action === 'add') {
    const isDuplicate = values.some(r => r[1].toString().trim().toLowerCase() === data.name.toString().trim().toLowerCase());
    if (isDuplicate) return "Error: มีชื่อห้องเรียน '" + data.name + "' นี้อยู่ในระบบแล้ว";
    
    sheet.appendRow([Date.now().toString(), data.name, data.color, 0]);
    return "เพิ่มห้องเรียน " + data.name + " สำเร็จ";
  }
  
  const rowIndex = values.findIndex(r => r[0].toString() === data.id.toString());
  if (rowIndex === -1) return "Error: ไม่พบข้อมูลห้องเรียน";

  if (action === 'update') {
    sheet.getRange(rowIndex + 1, 2, 1, 2).setValues([[data.name, data.color]]);
    return "อัปเดตห้องเรียนสำเร็จ";
  }

  if (action === 'delete') {
    sheet.deleteRow(rowIndex + 1);
    return "ลบห้องเรียนเรียบร้อย";
  }
}

// 3. ดึงข้อมูลห้องเรียน (พร้อมนับจำนวนนักเรียน)
function getRoomsData() {
  const roomSheet = getSheet('Rooms');
  const userSheet = getSheet('Users');
  if (!roomSheet) return [];
  
  const rooms = roomSheet.getDataRange().getValues();
  const users = userSheet ? userSheet.getDataRange().getValues() : [];
  rooms.shift(); // ตัดหัวตาราง
  
  return rooms.map(r => {
    const count = users.filter(u => u[2] === 'student' && String(u[3]).trim() === String(r[1]).trim()).length;
    return { id: r[0], name: r[1], color: r[2], count: count };
  });
}

// 4. ดึงรายชื่อนักเรียนตามห้อง
function getStudentsByRoom(roomName) {
  const sheet = getSheet('Users');
  const userData = sheet.getDataRange().getValues();
  const filtered = userData.filter(r => r[2] === 'student' && String(r[3]).trim() === String(roomName).trim());
  
  // เรียงลำดับตามรหัสนักเรียน (ตัวเลข)
  filtered.sort((a, b) => a[0].toString().localeCompare(b[0].toString(), undefined, {numeric: true}));
  
  return filtered.map(r => ({ id: r[0], name: r[1], class: r[3], username: r[4] }));
}

// 5. จัดการนักเรียน
function manageStudent(action, data) {
  const sheet = getSheet('Users');
  const values = sheet.getDataRange().getValues();

  if (action === 'add') {
    const isDuplicate = values.some(r => r[0].toString().trim() === data.id.toString().trim());
    if (isDuplicate) return "Error: รหัสนักเรียน '" + data.id + "' นี้มีอยู่ในระบบแล้ว";
    
    sheet.appendRow([data.id, data.name, 'student', data.class, data.username, data.password]);
    return "ลงทะเบียนนักเรียนสำเร็จ";
  }

  const rowIndex = values.findIndex(r => r[0].toString() === data.id.toString());
  if (rowIndex === -1) return "Error: ไม่พบข้อมูลนักเรียน";

  if (action === 'delete') {
    sheet.deleteRow(rowIndex + 1);
    return "ลบข้อมูลสำเร็จ";
  }
}

function updateStudent(data) {
  const sheet = getSheet('Users');
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex(r => r[0].toString() === data.id.toString());
  
  if (rowIndex !== -1) {
    sheet.getRange(rowIndex + 1, 2).setValue(data.name);
    if(data.password) sheet.getRange(rowIndex + 1, 6).setValue(data.password);
    return "อัปเดตเรียบร้อย";
  }
  return "Error: ไม่พบนักเรียนที่ต้องการแก้ไข";
}

// 6. ระบบ QR & Attendance
function checkInByQR(studentId) {
  const users = getSheet('Users').getDataRange().getValues();
  // ค้นหาโดยเทียบ String ป้องกันปัญหา Format ตัวเลขจาก Sheet
  const student = users.find(u => String(u[0]).trim() === String(studentId).trim());
  
  if (!student) return { status: "error", message: "ไม่พบข้อมูลนักเรียน รหัส: " + studentId };
  
  return { 
    status: "success", 
    studentId: student[0], 
    name: student[1], 
    class: student[3] 
  };
}

function saveAttendance(data) {
  const sheet = getSheet('Attendance');
  const now = new Date();
  
  sheet.appendRow([
    Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd"),
    data.studentId,
    data.name,
    data.class,
    data.status, // มา, สาย, ขาด, ลา
    Utilities.formatDate(now, "GMT+7", "HH:mm:ss")
  ]);
  
  return "บันทึกสถานะ [" + data.status + "] ของ " + data.name + " เรียบร้อย";
}

function updatePassword(userId, newPass) {
  const sheet = getSheet('Users');
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex(r => r[0].toString() === userId.toString());
  
  if (rowIndex !== -1) {
    sheet.getRange(rowIndex + 1, 6).setValue(newPass);
    return "เปลี่ยนรหัสผ่านเรียบร้อย";
  }
  return "Error: ไม่พบผู้ใช้";
}

function getDashboardData() {
  const sheet = getSheet('Attendance');
  let stats = { มา: 0, สาย: 0, ขาด: 0, ลา: 0 };
  
  if(!sheet) return { stats };
  
  const data = sheet.getDataRange().getValues();
  data.slice(1).forEach(r => { 
    if (stats[r[4]] !== undefined) stats[r[4]]++; 
  });
  
  return { stats };
}

const jwt = require('jsonwebtoken');

const token = jwt.sign({ 
  email: 'r.msaddek1607@myu.universitecentrale.tn', 
  sub: '0072d7e3-647a-46a9-8178-9500d2dc938d', 
  role: 'PARENT' 
}, 'changeme_in_production', { expiresIn: '1h' });

console.log("Token:", token);

fetch("http://localhost:3000/api/parent/children", {
  headers: { Authorization: `Bearer ${token}` }
})
.then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
})
.catch(console.error);

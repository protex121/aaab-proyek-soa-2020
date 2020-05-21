// REQUIRE YG NPM JS
const express = require('express');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');
const request = require('request');
const multer = require('multer');
const http = require('http');
const path = require('path');


// REQUIRE YANG NGAMBIL FILE
const hash = require('./hash_string');

const app = express();

app.use('/public/uploads/', express.static('./public/uploads'));

//message return
let message = []
message[200] = {status:200,message:"OK"}
message[201] = {status:201,message:"Created"}
message[500] = {status:500,message:"Internal Error"}
message[400] = {status:400,message:"Bad Request"}
message[401] = {status:401,message:"Unauthorized"}
message[404] = {status:404,message:"Not Found"}
message[409] = {status:409,message:"User has already registered"}
message[426] = {status:426,message:"Upgrade Required"}



//untuk mengakses .env
require("dotenv").config();

//config untuk webservicenya
app.use(express.urlencoded({ extended: true }));

//buat koneksi
const conn = mysql.createPool({
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST
});

//function untuk melakukan execute query
function executeQuery(conn, query){
  return new Promise(function(resolve,reject){
    conn.query(query,function(err,result){
        if(err){ reject(err); }
        else{ resolve(result); }
    });
  });
}

function getConnection() {
  return new Promise(function(resolve,reject){
    conn.getConnection(function(err,conn){
      if(err){ reject(err); }
      else{ resolve(conn); }
    });
  });
}

const storage = multer.diskStorage({
  destination : function(req,file,callback){
      callback(null,"./public/uploads");
  },
  filename : function (req,file,callback){
      const filename = file.originalname.split(".");
      const extension = filename[1];
      callback(null,Date.now() + "." + extension);
  }
});
const uploads = multer({
  storage : storage,
  fileFilter: function(req,file,callback){
      checkFileType(file,callback);
  }
});

function checkFileType(file,callback){
  const filetypes= /jpeg|jpg|png/;
  const extname=filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype=filetypes.test(file.mimetype);
  if(mimetype && extname){
      return callback(null,true);
  }else{
      callback('Invalid Format!!!');
  }
}

app.post("/api/register", async (req,res)=>{
  let user_email = req.body.user_email;
  let user_password = req.body.user_password;
  let user_balance = 0;
  let user_key = hash();
  let user_address = req.body.user_address;
  let user_phone = req.body.user_phone;
  let user_name = req.body.user_name;
  
  if(!user_email||!user_password||!user_address||!user_phone||!user_name) return res.status(400).send(message[400])
  
  const token = jwt.sign({    
      "email":user_email,
      "name" : user_name
  }   ,"proyek_soa");

  
  
  let query = `INSERT INTO user VALUES('${user_email}','${user_password}',${user_balance},'${token}','${user_address}','${user_phone}','${user_name}', NOW() + INTERVAL 7 DAY,'')`;
  let conn = await getConnection();

  try {
    let result = await executeQuery(conn, query);
    conn.release();

  } catch (error) {
      console.log("error : " +error)
      return res.status(409).send(message[409])
  }
  res.status(201).send(message[201]);
});

app.put("/api/update_profile/:email", async function (req,res) {
    let email = req.params.email;
    let password = req.body.password;
    let address = req.body.address;
    let phone = req.body.phone;
    let name = req.body.name;

    if (!email) {
        return res.status(400).send("No email reference!");
    }

    let checkUser = await executeQuery(conn, `select * from user where user_email = '${email}'`);
    if (checkUser.length < 1) {
        return res.status(400).send("User with that email doesn't exist!");
    }

    let updateEmail = await executeQuery(conn, `update user set user_password = '${password}', user_address = '${address}', user_phone = '${phone}', user_name = '${name}' where user_email = '${email}'`);
    if(updateEmail["affectedRows"] > 0){
        return res.status(200).send("Account berhasil diubah!");
    }
});


app.post("/api/top_up", async function (req,res) {
    let email = req.body.email;
    let password = req.body.password;
    let value = parseInt(req.body.value);

    if (!email) {
        return res.status(400).send("No email reference!");
    }
    if (!password) {
        return res.status(400).send("Password Required!");
    }

    let checkUser = await executeQuery(conn, `select * from user where user_email = '${email}' and user_password = '${password}'`);
    if (checkUser.length < 1) {
        return res.status(400).send("Email or password invalid!");
    }
    let balance = checkUser[0].user_balance;

    let topUp = await executeQuery(conn, `update user set user_balance = '${balance+value}' where user_email = '${email}'`);
    //   if(topUp["affectedRows"] > 0){
    //     let expired = false
    //     let user = {}
    //     //cek apakah expired
    //     try{
    //       user = jwt.verify(checkUser[0].user_key,"proyek_soa");
    //     }catch(err){
    //       //401 not authorized
    //       expired = true
    //     }
    //     let new_token
    //     if(expired){
    //         //kalau expired buat key baru dengan expiration date 30 hari
    //         new_token = jwt.sign({    
    //           "email":email,
    //           "name" : user_name
    //         },"proyek_soa", {
    //             expiresIn : '30d'
    //         });
    //     }
    //     else{
    //         //kalau tidak expired buat token baru dengan expiration date 30 hari ditambah dengan sisa hari sebelum expiration date
    //         let time = (new Date().getTime()/1000)-user.iat
    //         time+=(60*60*24*30)
    //         new_token = jwt.sign({    
    //           "email":email,
    //           "name" : user_name
    //         },"proyek_soa", {
    //             expiresIn : time+'d'
    //         });
    //     }

    //     let que = `
    //     UPDATE user 
    //     SET user_token = '${new_token}'
    //     WHERE user_email = '${email}' and user_password = '${password}'`

    //     let update_token = await executeQuery(conn,que)
    //     if(update_token.affectedRows>0)return res.status(200).send("Top Up Successful");
        
        
    // }
    conn.release();
});

app.post("/api/login",async function(req,res){
    const conn = await getConnection()
    const email = req.body.email
    const password = req.body.password
    let que = `SELECT * FROM user WHERE user_email = '${email}' and user_password = '${password}'`
    const user = await executeQuery(conn,que)
    if(user.length == 0) return res.status(400).send(message[400])
    let user_date = new Date(user[0].expired_date)
    let today_tmp = Date.now();
    let today = new Date(today_tmp)
    let today_str = today.getFullYear()+"-"+(today.getMonth()+1)+"-"+today.getDate()
    
    if(today>user_date) return res.status(426).send(message[426])

    console.log(user[0].expired_date)
    // if((new Date().getTime()/1000)-user.iat>3600){
    //     return res.status(400).send("Token expired");
    // }

    return res.status(200).send(user[0].user_key)
  })

app.get('/api/checkExpirationDate',async function(req,res){
    //let email = req.body.email
    //let password = req.body.password
    let key = req.body.key
    // let token = req.header("x-auth-token")

    //if(!token) return res.status(400).send("invalid key")

    const conn = await getConnection()
    let que_user = `SELECT * FROM user WHERE user_key = '${key}'`
    let user = await executeQuery(conn,que_user)
    if(user.length==0) return res.status(400).send(message[400])
    let token = user[0].user_key
    let exp_date = new Date(user[0].expired_date)
    let now = new Date(Date.now())
    let compare = Math.abs(exp_date - now);
    let day = Math.round((compare/1000)/(3600*24))
    console.log("exp date : "+exp_date.getDate()+"-"+exp_date.getMonth()+"-"+exp_date.getFullYear())
    console.log("today : "+now.getDate()+"-"+now.getMonth()+"-"+now.getFullYear())
    return res.status(200).send({status:200,message:day+" days"})


})  


app.post("/api/watchlist", async (req,res)=>{
  let email_user = req.body.user_email;
  let movie_id = req.body.movie_id;

  let query = `INSERT INTO watchlist VALUES('${email_user}','${movie_id}')`;
  let conn = await getConnection();
  let result = await executeQuery(conn, query);
  conn.release();

  res.status(200).send("Add to Watchlist");
});

app.get("/api/watchlist",async (req,res)=>{
  let user_email = req.query.user;
  let query = `SELECT movie_id FROM watchlist WHERE email_user='${user_email}'`;
  let conn = await getConnection();
  let result = await executeQuery(conn, query);
  conn.release();
  if(Object.keys(result).length == 0) return res.status(200).send("anda belum memiliki watchlist");

  res.status(200).send(result);
});

app.delete("/api/watchlist",async (req,res)=>{
  let email_user = req.body.user_email;
  let movie_id = req.body.movie_id;

  let query = `DELETE FROM watchlist WHERE movie_id='${movie_id}' AND email_user='${email_user}'`;
  let conn = await getConnection();
  let result = await executeQuery(conn, query);
  conn.release();

  res.status(200).send("Delete From Watchlist");
});

app.get("/api/search/movies",async (req,res)=>{
  let keyword = req.query.keyword;
  let type = req.query.type;
  let options = {
    'method': 'GET',
    'url': `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${keyword}`,
  };
  if (type == "tv series" || type == "series" || type == "tv") {
    options = {
      'method': 'GET',
      'url': `https://api.themoviedb.org/3/search/tv?api_key=${process.env.TMDB_API_KEY}&query=${keyword}`,
    };
  };

  request(options, function (error, response) {
    if (error) throw new Error(error);
    res.status(200).send(response.body);
  });
});

// ID COMMENT (A.I.), ID POST, ID USER, ISI COMMENT, COMMENTED AT, STATUS COMMENT
// POST COMMENT
app.post("/api/comment", async function (req, res) {
  let id_post = req.body.id_post, id_user = req.body.id_user, comment = req.body.comment;

  if (!id_post) return res.status(400).send("No id_post sent!");
  if (!id_user) return res.status(400).send("No id_user sent!");
  if (!comment) return res.status(400).send("Comment should not be empty!");

  let insertComment = await executeQuery(conn, `insert into comment values('','${id_post}','${id_user}','${comment}', CURRENT_TIMESTAMP(), 1)`);
  return res.status(200).send("User " + id_user + " commented");
})

// AMBIL COMMENT
app.get("/api/comment/get/:id", async function (req, res) {
  let id = req.params.id;

  if (!id) {
    let getAllComment = await executeQuery(conn, `select * from comment`);
    return res.status(200).send(getAllComment);
  }

  let getCommentById = await executeQuery(conn, `select * from comment where id_comment=${parseInt(id)}`);
  if (getCommentById.length < 1) return res.status(404).send("Comment not found");
  return res.status(200).send(getCommentById);
});

// UPDATE COMMENT
app.put("/api/comment/:id", async function (req, res) {
  let id = req.params.id, updatedComment = req.body.updatedComment;

  if (!id) return res.status(400).send("No id sent!");
  if (!updatedComment) return res.status(400).send("Updated comment is empty, maybe trying to delete?");

  let getCommentById = await executeQuery(conn, `select * from comment where id_comment=${parseInt(id)}`);
  if (getCommentById.length < 1) return res.status(404).send("Comment not found");

  try {
    let updateComment = await executeQuery(conn, `update comment set content_comment='${updatedComment}' where id_comment=${parseInt(id)}`);
    return res.status(200).send("Database updated, affected rows: " + updateComment["affectedRows"]);
  } catch (error) {
    return res.status(400).send(error);
  }
});

// DELETE COMMENT
app.delete("/api/comment/:id", async function (req, res) {
  let id = req.params.id;

  let getCommentById = await executeQuery(conn, `select * from comment where id_comment=${parseInt(id)}`);
  if (getCommentById.length < 1) return res.status(404).send("Comment not found");

  try {
    let deleteComment = await executeQuery(conn, `update comment set status_comment=0 where id_comment=${parseInt(id)}`);
    return res.status(200).send("Database updated, affected rows: " + deleteComment["affectedRows"]);
  } catch (error) {
    return res.status(400).send(error);
  }
});



app.get('/api/jadwal',async function(req,res){




})


function getTrailer(id){
  return new Promise(function(resolve,reject){
      var options = {
          'method': 'GET',
          'url': `https://api.themoviedb.org/3/movie/${id}/videos?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
        };
        request(options, function (error, response) { 
          if (error) reject(new Error(error));
          else resolve(response.body);
      });
  })  
}
app.get('/api/trailer/:id',async function(req,res){
  let id = req.params.id;
  let key = req.query.key;
  let con = await getConnection(); 
  if(!key){
    return res.status(404).send("API Key not found! Register to get your API key!");
  }
  let checkkey = await executeQuery(conn, `select * from user where user_key='${key}'`);
  if(checkkey.length==0){
    return res.status(404).send("Invalid API Key!");
  }

  let temp = [];
  try {
    const movie = JSON.parse(await getTrailer(id));
    const result = movie.results;
    for (let i = 0; i < result.length; i++) {
      if(result[i].site=="YouTube"){
        temp.push("Link : https://www.youtube.com/watch?v="+result[i].key);
      }
    }
    res.status(200).send(temp);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get('/api/test_geocode',async function(req,res){
  let address = 'Green Semanggi Mangrove'
  let town = 'Surabaya'
  let Country = 'ID'
  let loc = address+","+town+","+Country
  let hasil = await get_location(loc)
  return res.status(200).send({
    longitude : hasil.longt,
    latitude : hasil.latt
  })
})
// app.post("/uploadBerita",uploads.single("gambar"), async function(req,res){
//   const conn= await getConnection();
//   const judul=req.body.judul;
//   const kategori=req.body.kategori;
//   const isiberita = req.body.isiberita;
//   var options = {month:'short',day: '2-digit',minute:'2-digit',hour:'2-digit',year:'numeric' };
//   var tanggal = new Date().toLocaleDateString('en-US',options);
//   const filename = req.file.filename.toString();
//   const result = await executeQuery(conn,`INSERT INTO berita values('${judul}', '${isiberita}', '${tanggal}', '${filename}','${kategori}', null)`);
//   res.redirect("/adminPage");
// });
app.put("/api/updatepropic",uploads.single("propic"), async function (req, res) {
    const token = req.header("x-auth-token");
    const filename = req.file.filename.toString();
    if(!filename){
      return res.status(404).send("File Required");
    }
    let user = {};
    if(!token){
        return res.status(401).send("Token not found");
    }
    try{
         user = jwt.verify(token,"proyek_soa");
    }catch(err){
        return res.status(401).send("Token Invalid");
    }
    try {
      await executeQuery(conn, `update user set user_profile='${filename}' where user_email='${user.email}'`);
      return res.status(200).send("Profile Picture Updated");
    } catch (error) {
      return res.status(400).send(error);
    }
});


function search_movies(keyword){
  return new Promise(function(resolve,reject){
    key = process.env.TMDB_API_KEY;
    let options = {
      'method': 'GET',
      'url': `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${keyword}`,
    };
    request(options, async function (error, response) { 
        if(error) reject({"error":error})
        else{
            try {
                let arr_hasil = []
                let tmp = (await JSON.parse(response.body)).results
                if(tmp.length > 0){
                  for(let i = 0;i<tmp.length;i++){
                    let detail = await get_movie_detail(tmp.id)
                    arr_hasil.push(detail.imdb_id)
                  }
                }
                
                resolve(tmp);
            } catch (error) {
                reject({error:error})
            }
            
        }
    });
  })
}

function get_movie_detail(id){
  return new Promise(function(resolve,reject){
    key = process.env.TMDB_API_KEY;
    let options = {
      'method': 'GET',
      'url': `https://api.themoviedb.org/3/movie/${id}?api_key=${key}`,
    };
    request(options, async function (error, response) { 
        if(error) reject({"error":error})
        else{
            try {
                resolve(await JSON.parse(response.body));
            } catch (error) {
                reject({error:error})
            }   
        }
    });
  })
}




//untuk dapat Latitute Longitute
function get_location(location){
    return new Promise(function(resolve,reject){
        key = process.env.GEOCODE_API_KEY;
        let options = {
          'method': 'GET',
          'url': `https://geocode.xyz?auth=${key}&locate=${location}&json=1`,
        };
        request(options, async function (error, response) { 
            if(error) reject({"error":error})
            else{
                try {
                    resolve(await JSON.parse(response.body));
                } catch (error) {
                    reject({error:error})
                }
            }
        });
    })
    
}





//listener
app.listen(3000, function (req,res) { console.log("Listening on port 3000..."); });
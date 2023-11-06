const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PATH = path.join(__dirname,"covid19IndiaPortal.db");
let db = null;

const initializeServerAndDatabase = async () =>{
    try{
        db = await open({
            filename: PATH,
            driver: sqlite3.Database
        });
        app.listen(3000, () =>{
            console.log("Server is Started....");
        });
    }
    catch(e){
        console.log(e);
        process.exit(-1);
    }
}

initializeServerAndDatabase();

const convertToCamel = (state) => {
  let { state_id, state_name, population } = state;
  return {
    stateId: state_id,
    stateName: state_name,
    population: population,
  };
};

const convertDistrictToCamel = (district) => {
  let {
    district_id,
    district_name,
    state_id,
    cases,
    cured,
    active,
    deaths,
  } = district;
  return {
    districtId: district_id,
    districtName: district_name,
    stateId: state_id,
    cases: cases,
    cured: cured,
    active: active,
    deaths: deaths,
  };
};

//middleware function
const authenticateToken = (request,response,next) =>{
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined){
        jwtToken = authHeader.split(" ")[1];
    }
    if(jwtToken === undefined){
        response.status(401);
        response.send("Invalid JWT Token");
    }
    else{
        const isPasswordCorrect = jwt.verify(jwtToken, "dkshbfskjbkbhbsb", (error,payload) =>{
            if(error){
                response.status(401);
                response.send("Invalid JWT Token");
            }else{
                next();
            }
        });
    }    
};

//Login API

app.post("/login/", async (request,response) => {
    const {username,password} = request.body;
    const selectUserQuery = `
        SELECT * FROM user WHERE username = '${username}';
    `;
    const dbUser = await db.get(selectUserQuery);
    if(dbUser === undefined){
        response.status(400);
        response.send("Invalid user");
    }
    else{
        const isPasswordMatched = await bcrypt.compare(password,dbUser.password);
        if(isPasswordMatched){
            const payload = {username: username};
            const jwtToken = jwt.sign(payload,"dkshbfskjbkbhbsb");
            response.send({jwtToken});
        }
        else{
            
            response.status(400);
            response.send("Invalid password");
        }
    }
});


//API-1
app.get("/states/",authenticateToken, async (request, response) => {
  const QUERY = `
        SELECT 
           *
        FROM 
            state
        ORDER BY 
             state_id;
    `;
  const states = await db.all(QUERY);
  response.send(states.map((state) => convertToCamel(state)));
});

//API-2
app.get("/states/:stateId/",authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const QUERY = `
        SELECT 
           *
        FROM 
            state
        WHERE 
             state_id = ${stateId};
    `;
  const state = await db.get(QUERY);
  response.send(convertToCamel(state));
});

//API-3
app.post("/districts/",authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const QUERY = `
        INSERT INTO 
           district (district_name,state_id,cases,cured,active,deaths)
        VALUES (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  await db.run(QUERY);
  response.send("District Successfully Added");
});

//API-4
app.get("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;

  const QUERY = `
        SELECT 
           *
        FROM 
            district
        WHERE 
             district_id = ${districtId};
    `;
  const district = await db.get(QUERY);
  response.send(convertDistrictToCamel(district));
});

//API-5
app.delete("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;

  const QUERY = `
        DELETE FROM
            district
        WHERE 
             district_id = ${districtId};
    `;
  await db.get(QUERY);
  response.send("District Removed");
});

//API-6
app.put("/districts/:districtId/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const QUERY = `
        UPDATE 
           district
        SET
            district_name ='${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE
            district_id = ${districtId};
    `;
  await db.run(QUERY);
  response.send("District Details Updated");
});

//API-7
app.get("/states/:stateId/stats/",authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const QUERY = `
        SELECT 
           SUM(cases) AS totalCases,
           SUM(cured) AS totalCured,
           SUM(active) AS totalActive,
           SUM(deaths) AS totalDeaths
        FROM 
            district
        WHERE
             state_id = ${stateId};
    `;
  const stats = await db.get(QUERY);
  response.send(stats);
});

//API-8
app.get("/districts/:districtId/details/",authenticateToken, async (request, response) => {
  const { districtId } = request.params;
  const QUERY = `
        SELECT 
           state.state_name
        FROM 
            district INNER JOIN state ON district.state_id = state.state_id
        WHERE
             district_id = ${districtId};
    `;
  const stats = await db.get(QUERY);
  const { state_name } = stats;
  let obj = {
    stateName: state_name,
  };
  response.send(obj);
});

module.exports = app;
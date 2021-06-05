const express = require('express')
const { json, urlencoded } = require('body-parser')
const config = require('config')
const pg = require('pg')
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const PORT = process.env.PORT || config.get('server.port')

const pool = new pg.Pool({
    connectionString: 'postgres://uygxkwhb:WuAXbJtfjK7RvukuHSKuAD1CivWdr6kX@tuffi.db.elephantsql.com:5432/uygxkwhb',
    ssl: {
        rejectUnauthorized: false
    }
})

const verifyJWT = (req, res, next) => {
    const bearer = req.headers['authorization'];
    
    const token = bearer.split(" ")[1];

    if (!token) return res.status(401).json({ auth: false, message: 'Authorization required' });
    
    jwt.verify(token, config.get('secret'), err => {
      
      if (err) {
        return res.status(500).json({ auth: false, message: 'Authorization failed' });
      }

      next();
    });
}

const app = express()

app.use(json())
app.use(urlencoded({ extended: true }))

app.route('/verify')
.post((req, res) => {
    const query = `SELECT * FROM alunos WHERE ra=${req.body.ra}`

    pool.query(query, (err, selectUser) => {
        
        if (err || selectUser.rows.length <= 0) {
            return res.status(500).send({ 
                ra: false, 
                senha: false, 
                token: null 
            })
        }

        else if(!bcrypt.compareSync(req.body.senha, selectUser.rows[0].senha)){
            return res.status(403).send({ 
                ra: true, 
                senha: false, 
                token: null 
            })
        }

        const token = jwt.sign(
            {
                data: { 
                    id: selectUser.rows[0].id,
                    ra: selectUser.rows[0].ra,
                    nome: selectUser.rows[0].nome
                }
            }, 
            config.get('secret'), 
            { expiresIn: '24h' }
        );

        console.log(token)

        res.status(200).send({ 
            ra: true, 
            senha: true, 
            token: token 
        })
    })
})


app.route('/alunos')
.get(verifyJWT, (_, res) => {

    const query = 'SELECT id, nome, ra FROM alunos;'

    pool.query(query, (err, dbResponse) => {
        
        if (err) {
            return res.status(500).send(err)
        }
            
        res.status(200).json(dbResponse.rows)
    })
})
.post(verifyJWT, (req, res) => {
    
    const pass = bcrypt.hashSync(req.body.senha, 10);

    const query = `INSERT INTO alunos (nome, ra, senha)
                   VALUES ('${req.body.nome}', 
                           '${req.body.ra}',
                           '${pass}')`
                           
    pool.query(query, (err, dbResponse) => { 

        if (err) {
            return res.status(500).send(err)
        }
            

        res
            .status(200)
            .send(dbResponse.rows)
    });
})

// GET by id
app.get('/alunos/:id', verifyJWT, (req, res) => {

    const query = `SELECT id, nome, ra FROM alunos WHERE id=${req.params.id}`
    
    pool.query(query, (err, dbResponse) => { 

        //Por id retorna um!!
        if (err && dbResponse.rows.length > 1) {
            return res.status(500).send(err)
        }
            
        res
            .status(200)
            .send(...dbResponse.rows)
    });

})

app.route('/reset')
.get(verifyJWT, (_, res) => {

    let query = `DROP TABLE IF EXISTS alunos;`
    query += `CREATE TABLE alunos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100),
        ra INTEGER,
        senha TEXT
    );`

    pool.query(query, (err, _) => { 
        if (err) {
            return res.status(500).send(err)
        }
        
        console.warn('Banco de dados resetado!!')        
        res.status(200).send('Banco de dados resetado!!');
    })
})

app.listen(PORT, () => {
    console.log(`Server on : ${PORT}`)
})
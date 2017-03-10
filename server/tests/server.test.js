/* eslint-env mocha */

const expect = require('expect')
const request = require('supertest')
const {ObjectID} = require('mongodb')

const {app} = require('./../server')
const {Todo} = require('./../models/todo')
const {User} = require('./../models/user')
const {todos, populateTodos, users, populateUsers} = require('./seed/seed')

beforeEach(populateUsers)
beforeEach(populateTodos)

describe('POST /todos', () => {
  it('should create a new todo', (done) => {
    let text = 'Test todo text'

    request(app)
      .post('/todos')
      .set('x-auth', users[0].tokens[0].token)
      .send({text})
      .expect(200)
      .expect((res) => {
        expect(res.body.text).toBe(text)
      })
      .end((err, res) => {
        if (err) {
          return done(err)
        }

        Todo.find({text}).then((todos) => {
          expect(todos.length).toBe(1)
          expect(todos[0].text).toBe(text)
          done()
        }).catch((e) => done(e))
      })
  })

  it('should not create todo with invalid body data', (done) => {
    request(app)
      .post('/todos')
      .set('x-auth', users[0].tokens[0].token)
      .send({})
      .expect(400)
      .end((err, res) => {
        if (err) {
          return done(err)
        }

        Todo.find().then((todos) => {
          expect(todos.length).toBe(2)
          done()
        }).catch((e) => done(e))
      })
  })
})

describe('GET /todos', () => {
  it('should get all todos', (done) => {
    request(app)
      .get('/todos')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body.todos.length).toBe(1)
      })
      .end(done)
  })
})

describe('GET /todos/:?', () => {
  it('should return todo doc', (done) => {
    let hexId = todos[0]._id.toHexString()
    request(app)
      .get(`/todos/${hexId}`)
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body.todo.text).toBe(todos[0].text)
      })
      .end(done)
  })

  it('should not return todo doc created by other user', (done) => {
      let hexId = todos[1]._id.toHexString()
      request(app)
        .get(`/todos/${hexId}`)
        .set('x-auth', users[0].tokens[0].token)
        .expect(404)
        .end(done)
    })

  it('should return 404 if todo not found', (done) => {
    let hexId = new ObjectID().toHexString()

    request(app)
      .get(`/todos/${hexId}`)
      .set('x-auth', users[0].tokens[0].token)
      .expect(404)
      .end(done)
  })

  it('should return 400 for non-ObjectIds', (done) => {
    request(app)
      .get('/todos/123')
      .set('x-auth', users[0].tokens[0].token)
      .expect(400)
      .end(done)
  })
})

describe('DELETE /todos/:id', () => {
  it('should remove a todo', (done) => {
    let hexId = todos[1]._id.toHexString()

    request(app)
      .delete(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body.todo._id).toBe(hexId)
        return Todo.findById(hexId).then((todo) => {
          expect(todo).toNotExist()
          done()
        })
      })
      .catch((err) => done(err))
  })

  it('should not remove a todo', (done) => {
    let hexId = todos[0]._id.toHexString()

    request(app)
      .delete(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(404)
      .expect((res) => {
        return Todo.findById(hexId).then((todo) => {
          expect(todo).toExist()
          done()
        })
      })
      .catch((err) => done(err))
  })

  it('should return 404 if todo not found', (done) => {
    let hexId = new ObjectID().toHexString()

    request(app)
      .delete(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .expect(404)
      .end(done)
  })

  it('should return 400 if object id is invalid', (done) => {
    request(app)
      .delete('/todos/123')
      .set('x-auth', users[1].tokens[0].token)
      .expect(400)
      .end(done)
  })
})

describe('PATCH /todos:id', (done) => {
  it('should update the todo', (done) => {
    let hexId = todos[0]._id.toHexString()
    let body = {
      text: 'Update from supertest 1',
      completed: true
    }
    request(app)
      .patch(`/todos/${hexId}`)
      .set('x-auth', users[0].tokens[0].token)
      .send(body)
      .expect(200)
      .expect(res => {
        expect(res.body.todo.text).toBe(body.text)
        expect(res.body.todo.completed).toBe(true)
        expect(res.body.todo.completedAt).toBeA('number')
        done()
      })
      .catch((err) => done(err))
  })

  // duplicate above test
  // try to update first todo as second user
  // 404
  it('should not update the todo created by another user', (done) => {
    let hexId = todos[0]._id.toHexString()
    let body = {
      text: 'Update from supertest 1',
      completed: true
    }
    request(app)
      .patch(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .send(body)
      .expect(404)
      .then(res => done())
      .catch((err) => done(err))
  })

  it('should clear completedAt when todo is not completed', (done) => {
    let hexId = todos[1]._id.toHexString()
    let body = {
      text: 'Update from supertest 2',
      completed: false
    }
    // auth as second
    request(app)
      .patch(`/todos/${hexId}`)
      .set('x-auth', users[1].tokens[0].token)
      .send(body)
      .expect(200)
      .expect(res => {
        expect(res.body.todo.text).toBe(body.text)
        expect(res.body.todo.completed).toBe(false)
        expect(res.body.todo.completedAt).toNotExist()
        done()
      })
      .catch((err) => done(err))
  })
})

describe('GET /users/me', () => {
  it('should return user if authenticated', (done) => {
    request(app)
      .get('/users/me')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect((res) => {
        expect(res.body._id).toBe(users[0]._id.toHexString())
        expect(res.body.email).toBe(users[0].email)
        done()
      })
      .catch((err) => done(err))
  })

  it('should return a 401 if not authenticated', (done) => {
    request(app)
      .get('/users/me')
      .expect(401)
      .expect((res) => {
        expect(res.body).toEqual({})
        done()
      }).catch((err) => done(err))
  })
})

describe('POST /users', () => {
  it('should create a user', (done) => {
    let email = 'example@example.com'
    let password = '123mnb!'

    request(app)
      .post('/users')
      .send({email, password})
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-auth']).toExist()
        expect(res.body._id).toExist()
        expect(res.body.email).toBe(email)
      })
      .then((res) => User.findOne({email}))
      .then((user) => {
        expect(user).toExist()
        expect(user.password).toNotBe(password)
        done()
      })
      .catch((err) => done(err))
  })

  it('should return validation errors if request invalid', (done) => {
    let email = 'lkj'
    let password = '123'

    request(app)
      .post('/users')
      .send({email, password})
      .expect(400)
      .end(done)
  })

  it('should not create a user if email in use', (done) => {
    request(app)
      .post('/users')
      .send({
        email: users[0].email,
        password: 'zxc'
      })
      .expect(400)
      .end(done)
  })
})

describe('POST /users/login', () => {
  it('should login user and return auth token', (done) => {
    request(app)
      .post('/users/login')
      .send({
        email: users[1].email,
        password: users[1].password
      })
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-auth']).toExist()
      })
      .then((res) => {
        return User.findById(users[1]._id)
          .then((user) => {
            expect(user.tokens[1]).toInclude({
              access: 'auth',
              token: res.headers['x-auth']
            })
            done()
          })
      })
      .catch((err) => done(err))
  })

  it('should reject invalid login', (done) => {
    request(app)
      .post('/users/login')
      .send({
        email: users[1].email,
        password: '123'
      })
      .expect(400)
      .expect((res) => {
        expect(res.headers['x-auth']).toNotExist()
        return User.findById(users[1]._id)
          .then((user) => {
            expect(user.tokens.length).toBe(1)
            done()
          })
      })
      .catch((err) => done(err))
  })
})

describe('DELETE /users/me/token', () => {
  it('should remove auth token on logout', (done) => {
    request(app)
      .delete('/users/me/token')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .then((res) => {
        return User.findById(users[0]._id)
          .then((user) => {
            expect(user.tokens.length).toBe(0)
            done()
          })
      })
      .catch((err) => done(err))
  })
})

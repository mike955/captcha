const svgCaptcha = require('svg-captcha');
const crypto = require('crypto');
const Redis = require('ioredis');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const app = new Koa();
const captcha_conf = require('./conf');

const redis = new Redis({
  port: 6379,
  host: '192.168.56.101',
  db: 12,
});

if (redis.connector.connecting == true) console.log('connect redis failed');
console.log('connect redis success');

app.use(bodyParser());
app.use(async ctx => {
  let req = ctx.req;
  if (req.url === '/getCaptcha') return await getCaptcha(ctx);
  if (req.url === '/validateCaptcha') return await validateCaptcha(ctx);
  ctx.status = 404;
  ctx.body = 'Not Found';
});

app.listen(3000, err => {
  if (err) throw new Error(err);
  console.log('server listen 3000');
});

async function getCaptcha(ctx) {
  let { type, expire } = captcha_conf;
  let cap = await generateCaptcha(captcha_conf[type], type);
  // 增加 存储到 redis 步骤
  let { pid, text, svg } = cap;
  let set_res = await redis.setex(pid, expire, text);
  if (set_res != 'OK') console.log('set cap to redis failed');
  console.log('set cap to redis success');
  ctx.body = { pid, svg };
}

async function validateCaptcha(ctx) {
  let req = ctx.request.body;
  let { pid, code } = req;
  let res = { data: false };
  if (pid == undefined || code == undefined) throw new Error('request body error');
  let pid_code = await redis.get(pid);
  if (pid_code == code) {
    res.data = true;
    process.nextTick(async () => {
      let del_res = await redis.del(pid);
      del_res == 1 ? console.log(`delete key ${pid} failed`) : console.log(`delete key ${pid} success`);
    });
  }
  ctx.body = res;
}

async function generateCaptcha(conf, type) {
  let c = type == 'pic' ? svgCaptcha.create(conf) : svgCaptcha.createMathExpr(conf);
  let pid = crypto.randomBytes(16).toString('hex');
  return { pid, text: c.text, svg: c.data };
}

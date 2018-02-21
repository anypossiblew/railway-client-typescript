# railway-client-typescript
High speed railway client (TypeScript version)


## Usage
1. 安装依赖包 `npm install`

2. 更改 **./dist/index.js** 文件中的账号和乘车信息。

3. 查询余票信息：`node dist/index.js leftTicketReport` ， 添加车次到 **./dist/index.js** 文件中

4. 订票: `node dist/index.js`，首次登录需要输入验证码，验证码文件 `./captcha.BMP`，打开验证码文件，找到答案对应的坐标依次输入到命令行窗口，用 "," 连接，例如：110,45,110,110,250,110

```
|40,45 |110,45 |180,45 |250,45 |
|40,110|110,110|180,110|250,110|
```

5. 取消排队订单：`node dist/index.js cancelOrderQueue`


## Develop

`npm install`

`npm start` or `node dist/index.js`

### Prerequisites:

gulp: `npm install gulp -g`

## Updates

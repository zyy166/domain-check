// 定义外部变量
let sitename = "域名监控"; //变量名SITENAME，自定义站点名称，默认为“域名监控”
let domains = ""; //变量名DOMAINS，填入域名信息json文件直链，必须设置的变量
let tgid = ""; //变量名TGID，填入TG机器人ID，不需要提醒则不填
let tgtoken = ""; //变量名TGTOKEN，填入TG的TOKEN，不需要提醒则不填
let days = 7; //变量名DAYS，提前几天发送TG提醒，默认为7天，必须为大于0的整数

async function sendtgMessage(message, tgid, tgtoken) {
  if (!tgid || !tgtoken) return;
  const url = `https://api.telegram.org/bot${tgtoken}/sendMessage`;
  const params = {
    chat_id: tgid,
    text: message,
  };
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } catch (error) {
    console.error('Telegram 消息推送失败:', error);
  }
}

export default {
  async fetch(request, env) {
    sitename = env.SITENAME || sitename;
    domains = env.DOMAINS || domains;
    tgid = env.TGID || tgid;
    tgtoken = env.TGTOKEN || tgtoken;
    days = Number(env.DAYS || days);

    if (!domains) {
      return new Response("DOMAINS 环境变量未设置", { status: 500 });
    }

    try {
      const response = await fetch(domains);
      if (!response.ok) throw new Error('Network response was not ok');
      
      domains = await response.json();
      if (!Array.isArray(domains)) throw new Error('JSON 数据格式不正确');
      
      const today = new Date().toISOString().split('T')[0]; // 当前日期字符串

      for (const domain of domains) {
        const expirationDate = new Date(domain.expirationDate);
        const daysRemaining = Math.ceil((expirationDate - new Date()) / (1000 * 60 * 60 * 24));

        if (daysRemaining > 0 && daysRemaining <= days) {
          const message = `[域名] ${domain.domain} 将在 ${daysRemaining} 天后过期。过期日期：${domain.expirationDate}`;
          
          const lastSentDate = await env.DOMAINS_TG_KV.get(domain.domain); // 以域名为键获取上次发送时间
          
          if (lastSentDate !== today) { // 检查是否已经在今天发送过
            await sendtgMessage(message, tgid, tgtoken); // 发送通知
            await env.DOMAINS_TG_KV.put(domain.domain, today); // 更新发送日期
          }
        }
      }

      const htmlContent = await generateHTML(domains, sitename);
      return new Response(htmlContent, {
        headers: { 'Content-Type': 'text/html' },
      });
    } catch (error) {
      console.error("Fetch error:", error);
      return new Response("无法获取或解析域名的 json 文件", { status: 500 });
    }
  }
};

async function generateHTML(domains, SITENAME) {
  const siteIcon = 'https://pan.811520.xyz/icon/domain.png';
  const bgimgURL = 'https://bing.img.run/1920x1080.php';
  const rows = await Promise.all(domains.map(async info => {
    const registrationDate = new Date(info.registrationDate);
    const expirationDate = new Date(info.expirationDate);
    const today = new Date();
    const totalDays = (expirationDate - registrationDate) / (1000 * 60 * 60 * 24);
    const daysElapsed = (today - registrationDate) / (1000 * 60 * 60 * 24);
    const progressPercentage = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));
    const daysRemaining = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
    const isExpired = today > expirationDate;
    const statusColor = isExpired ? '#e74c3c' : '#2ecc71';
    const statusText = isExpired ? '已过期' : '正常';

    return `
      <tr>
        <td><span class="status-dot" style="background-color: ${statusColor};" title="${statusText}"></span></td>
        <td>${info.domain}</td>
        <td><a href="${info.systemURL}" target="_blank">${info.system}</a></td>
        <td>${info.registrationDate}</td>
        <td>${info.expirationDate}</td>
        <td>${isExpired ? '已过期' : daysRemaining + ' 天'}</td>
        <td>
          <div class="progress-bar">
            <div class="progress" style="width: ${progressPercentage}%;"></div>
          </div>
        </td>
      </tr>
    `;
  }));

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${SITENAME}</title>
      <link rel="icon" href="${siteIcon}" type="image/png">
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background-image: url('${bgimgURL}');
          color: #333;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .container {
          flex: 1;
          width: 95%;
          max-width: 1200px;
          margin: 20px auto;
          background-color: rgba(255, 255, 255, 0.7);
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          border-radius: 5px;
          overflow: hidden;
        }
        h1 {
          background-color: #3498db;
          color: #fff;
          padding: 20px;
          margin: 0;
        }
        .table-container {
          width: 100%;
          overflow-x: auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          white-space: nowrap;
          table-layout: auto;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
          white-space: nowrap;
        }
        th {
          background-color: rgba(242, 242, 242, 0.7);
          font-weight: bold;
        }
        .status-dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #2ecc71;
        }
        .progress-bar {
          width: 100%;
          min-width: 100px;
          background-color: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }
        .progress {
          height: 20px;
          background-color: #3498db;
        }
        .footer {
          text-align: center;
          padding: 0;
          background-color: #3498db;
          font-size: 0.9rem;
          color: #fff;
          margin-top: auto;
        }
        .footer a {
          color: white;
          text-decoration: none;
          margin-left: 10px;
          transition: color 0.3s ease;
        }
        .footer a:hover {
          color: #f1c40f;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${SITENAME}</h1>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>状态</th>
                <th>域名</th>
                <th>域名注册商</th>
                <th>注册时间</th>
                <th>过期时间</th>
                <th>剩余天数</th>
                <th>使用进度</th>
              </tr>
            </thead>
            <tbody>
              ${rows.join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div class="footer">
        <p>
          Copyright © 2025 Yutian81&nbsp;&nbsp;&nbsp;| 
          <a href="https://github.com/yutian81/domain-check" target="_blank">GitHub Repository</a>&nbsp;&nbsp;&nbsp;| 
          <a href="https://blog.811520.xyz/" target="_blank">青云志博客</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

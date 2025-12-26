module.exports = {
  apps: [{
    name: "app",
    script: "./src/server.js",
    instances: "max", // CPU 코어 수만큼 프로세스 실행 (클러스터 모드)
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
    }
  }]
}
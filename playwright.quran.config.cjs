const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'quran-offline.spec.cjs',timeout:30000,workers:1,reporter:'line',
 use:{baseURL:'http://127.0.0.1:8765',locale:'en-US',viewport:{width:390,height:844},serviceWorkers:'allow',screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:process.env.MUSHAF_BROWSER_EXECUTABLE?{executablePath:process.env.MUSHAF_BROWSER_EXECUTABLE}:{}}
});

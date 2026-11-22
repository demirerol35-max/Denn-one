const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
 testDir:'./tests',testMatch:'mushaf-book.spec.cjs',timeout:30000,workers:1,reporter:'line',
 use:{baseURL:'http://127.0.0.1:8765',viewport:{width:1280,height:900},serviceWorkers:'block',screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:process.env.MUSHAF_BROWSER_EXECUTABLE?{executablePath:process.env.MUSHAF_BROWSER_EXECUTABLE}:{}}
});


<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <section>
        <div class="footer-brand"><strong>FreshCare</strong><span>鮮果旬味選品</span></div>
        <p>秉持職人標準，自全球產地至府上冷鏈直達。每一份鮮果禮盒皆蘊含對自然的敬意與最高品質的堅守。</p>
        <div class="footer-tags"><span>產地直送</span><span>安心檢驗</span><span>全程冷鏈</span><span>售後保障</span></div>
      </section>
      <section>
        <h2>客戶禮遇與諮詢</h2>
        <p>✉　service@freshcarefruit.tw</p><p>☎　免付費專線 0800-888-920</p><p>◷　週一至週五 09:00 - 18:00</p>
      </section>
      <section>
        <h2>快捷服務</h2>
        <RouterLink to="/contact">商品問題反映申請</RouterLink>
        <RouterLink to="/track">案件進度查詢</RouterLink>
      </section>
    </div>
    <div class="footer-bottom">
      <span>© 2026 FreshCare 鮮果選品. All rights reserved.</span>
      <span class="footer-bottom-note">珍惜每一份旬味心意
        <RouterLink class="admin-entry" to="/admin/login" aria-label="管理員登入" title="管理員登入">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.7-3 8.3-7 10-4-1.7-7-5.3-7-10V6l7-3Z"/><path d="M9.5 12h5"/></svg>
        </RouterLink>
      </span>
    </div>
  </footer>
</template>

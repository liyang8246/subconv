<template>
<div class="w-full min-h-screen flex items-center justify-center p-4">
  <div class="card w-xl bg-base-100 card-md shadow-sm">
  <div class="card-body">
    <h2 class="card-title">订阅转换</h2>
    <p>本网站为 Serverless 部署, 是无状态和无服务器设计</p>
    <div class="divider my-0"></div>
    <div>
      <fieldset class="fieldset">
        <legend class="fieldset-legend">订阅链接</legend>
        <textarea class="textarea h-24 w-full" placeholder="请输入订阅链接"></textarea>
        <div class="label">每行一个订阅链接 仅支持 Clash 规则格式</div>
      </fieldset>
      <fieldset class="fieldset">
        <legend class="fieldset-legend">规则预设</legend>
        <select class="select w-full">
          <option disabled selected>请选择预设规则</option>
          <option>!TODO Chrome</option>
          <option>!TODO FireFox</option>
          <option>!TODO Safari</option>
        </select>
        <span class="label">!TODO 规则说明</span>
      </fieldset>
    </div>
    <div class="divider mt-0 mb-2"></div>
    <div class="join">
      <input class="input join-item w-full" placeholder="待生成订阅链接..." />
      <button class="btn join-item btn-soft"><span class="icon-[tabler--copy]"></span></button>
    </div>
    <div class="join">
      <select class="select join-item w-32">
        <option selected>v1.mk</option>
        <option>d1.mk</option>
      </select>
      <input class="input join-item w-full" placeholder="待生成订阅短链..." />
      <button class="btn join-item btn-soft"><span class="icon-[tabler--copy]"></span></button>
    </div>
    <div class="divider my-2"></div>
    <div class="justify-end card-actions">
      <button class="btn btn-primary">生成订阅链接</button>
    </div>
  </div>
</div>
</div>
</template>
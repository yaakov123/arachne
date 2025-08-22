<template>
    <h1>Logger</h1>
    <Button label="Click" @click="onClick" />
</template>

<script setup lang="ts">
function onClick() {
    console.log('Click')
}
</script>

<style scoped></style>

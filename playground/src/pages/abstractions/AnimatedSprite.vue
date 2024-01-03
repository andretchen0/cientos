<script setup lang="ts">
import { TresCanvas, useRenderLoop } from '@tresjs/core'
import { OrbitControls, AnimatedSprite, TorusKnot } from '@tresjs/cientos'
import { BasicShadowMap, SRGBColorSpace, NoToneMapping, Color } from 'three'
import { shallowRef, shallowReactive } from 'vue'
import { TresLeches, useControls } from '@tresjs/leches'
import '@tresjs/leches/styles'

const gl = {
  clearColor: '#82DBC5',
  shadows: true,
  alpha: false,
  shadowMapType: BasicShadowMap,
  outputColorSpace: SRGBColorSpace,
  toneMapping: NoToneMapping,
}

const leviosoState = shallowReactive({
  speed: 5,
  rotationFactor: 1,
  floatFactor: 1,
  range: [-0.1, 0.1],
})

const { speed, rotationFactor, floatFactor } = useControls({
  speed: { value: leviosoState.speed, min: 0, max: 100, step: 1 },
  rotationFactor: { value: leviosoState.rotationFactor, min: 0, max: 10, step: 1 },
  floatFactor: { value: leviosoState.floatFactor, min: 0, max: 10, step: 1 },
})

watch([speed.value, rotationFactor.value, floatFactor.value], () => {
  leviosoState.speed = speed.value.value
  leviosoState.rotationFactor = rotationFactor.value.value
  leviosoState.floatFactor = floatFactor.value.value
})

let cooldown = 2
const animations = ['runnerWalk']
let animationI = 0

const animation = ref(animations[animationI])
const loop = ref(true)

let flipXCooldown = 1
const flipX = ref(true)
useRenderLoop().onLoop(({ delta }) => {
  cooldown -= delta
  while (cooldown < 0) {
    animationI++
    animationI %= animations.length
    cooldown += 2
    //animation.value = animations[animationI]
    //loop.value = !loop.value
  }

  flipXCooldown -= delta
  while (flipXCooldown < 0) {
    flipX.value = !flipX.value
    flipXCooldown += 1
  }
})
const groupRef = shallowRef()
</script>

<template>
  <TresCanvas v-bind="gl">
    <TresPerspectiveCamera :position="[11, 11, 11]" />
    <OrbitControls />
    <Suspense>
      <AnimatedSprite 
        :fps="20"
        :position="[1, 2, 1]"
        image-url="/debug_atlas.png" 
        atlas-url="/debug_atlas.json"
        :definitions="{
          runnerAscended: '0,1,0,1,0(4),1-3,1-3,3(3),4',
          enemy0Lightning: '0-1(3),2,3(15),2-0',
        }"
        :reset-on-end="true"
        :loop="loop"
        :animation="animation"
      />
    </Suspense>
    <Suspense>
      <AnimatedSprite 
        :fps="20"
        :position="[2, 2, 1]"
        image-url="/debug_atlas.png" 
        atlas-url="/debug_atlas.json"
        :definitions="{
          runnerAscended: '0,1,0,1,0(4),1-3,1-3,3(3),4',
          enemy0Lightning: '0-1(3),2,3(15),2-0',
        }"
        :reset-on-end="true"
        :loop="loop"
        :animation="animation"
      />
    </Suspense>
    <Suspense>
      <AnimatedSprite 
        :fps="20"
        :position="[3, 2, 1]"
        image-url="/debug_atlas.png" 
        atlas-url="/debug_atlas.json"
        :definitions="{
          runnerAscended: '0,1,0,1,0(4),1-3,1-3,3(3),4',
          enemy0Lightning: '0-1(3),2,3(15),2-0',
        }"
        :reset-on-end="true"
        :loop="loop"
        :animation="animation"
      />
    </Suspense>
    <Suspense>
      <AnimatedSprite 
        :fps="20"
        :position="[4, 2, 1]"
        image-url="/debug_atlas.png" 
        atlas-url="/debug_atlas.json"
        :definitions="{
          runnerAscended: '0,1,0,1,0(4),1-3,1-3,3(3),4',
          enemy0Lightning: '0-1(3),2,3(15),2-0',
        }"
        :reset-on-end="true"
        :loop="loop"
        :animation="animation"
      />
    </Suspense>
    <Suspense>
      <AnimatedSprite 
        :fps="20"
        :position="[5, 2, 1]"
        image-url="/debug_atlas.png" 
        atlas-url="/debug_atlas.json"
        :definitions="{
          runnerAscended: '0,1,0,1,0(4),1-3,1-3,3(3),4',
          enemy0Lightning: '0-1(3),2,3(15),2-0',
        }"
        :reset-on-end="true"
        :loop="loop"
        :animation="animation"
        :as-sprite="true"
      />
    </Suspense>
    <Suspense>
      <AnimatedSprite 
        :fps="20"
        :position="[6, 1, 2]"
        image-url="/debug_atlas.png" 
        atlas-url="/debug_atlas.json"
        :definitions="{
          runnerAscended: '0,1,0,1,0(4),1-3,1-3,3(3),4',
          enemy0Lightning: '0-1(3),2,3(15),2-0',
        }"
        :reset-on-end="true"
        :loop="loop"
        :animation="animation"
        :on-frame="() => console.log('frame')"
        :on-loop-end="() => console.log('loop end')"
        :on-load="() => console.log('load')"
        :on-end="() => console.log('end')"
        :as-sprite="true"
      />
    </Suspense>
    <TresGridHelper :args="[10, 10]" />
  </TresCanvas>
</template>

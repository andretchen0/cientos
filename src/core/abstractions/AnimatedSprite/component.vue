<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRenderLoop } from '@tresjs/core'
import type { Group, Mesh, Sprite, Texture } from 'three'
import { DoubleSide } from 'three'
import type { AtlasFrame } from './Atlas'
import { useAnimatedSpriteAtlas } from './Atlas'

export interface AnimatedSpriteProps {
  definitions?: Record<string, string>
  fps?: number
  atlasUrl: string
  imageUrl: string
  loop?: boolean
  animation?: string | [number, number] | number
  onLoad?: Function
  onEnd?: Function
  onLoopEnd?: Function
  onFrame?: Function
  paused?: boolean
  flipX?: boolean
  resetOnEnd?: boolean
  alphaTest?: number
  asSprite?: boolean
  pxInWorldUnits?: number
  anchor?: [number, number]
}

const props = withDefaults(defineProps<AnimatedSpriteProps>(), {
  fps: 60,
  loop: true,
  animation: 0,
  paused: false,
  flipX: false,
  alphaTest: 0.0,
  resetOnEnd: false,
  asSprite: false,
  pxInWorldUnits: 0.10,
  anchor: () => [0.5, 1.0],
})

const page = await useAnimatedSpriteAtlas().getPageAsync(props.atlasUrl, props.imageUrl)
if (props.definitions) {
  page.setDefinitions(props.definitions)
}

const animatedSpriteGroupRef = ref<InstanceType<typeof Group> | null>()
const animatedSpriteSpriteRef = ref<InstanceType<typeof Mesh> | InstanceType<typeof Sprite> | null>(null)
const animatedSpriteMaterialRef = ref()
const animatedSpriteTextureRef = ref(page.getTexture())

const texture: Texture = page.getTexture()

let frameNum = 0
let cooldown = 1
let frame: AtlasFrame | undefined = undefined
let animation: AtlasFrame[] = page.getFrames(props.animation)
let frameHeldOnLoopEnd = false

if (props.onLoad) props.onLoad()

updateFrame(animation[frameNum])

useRenderLoop().onLoop(({ delta }) => {
  if (!animatedSpriteSpriteRef.value) return
  if (!props.paused && !frameHeldOnLoopEnd) {
    cooldown -= delta * props.fps
  }
  while (cooldown <= 0) {
    frameNum++
    cooldown++
    if (props.onLoopEnd && props.loop && frameNum >= animation.length) props.onLoopEnd()
    if (!props.loop && frameNum >= animation.length) {
      frameHeldOnLoopEnd = true
      frameNum = props.resetOnEnd ? 0 : animation.length - 1
      if (props.onEnd) props.onEnd()
    }

    if (props.loop) {
      frameNum %= animation.length
    }
    else {
      frameNum = Math.min(animation.length - 1, frameNum)
    }
  }

  updateFrame(animation[frameNum])
})

const scaleX = ref(1)
const scaleY = ref(1)
const positionX = ref(0)
const positionY = ref(0)

function updateFrame(newFrame: AtlasFrame) {
  if (newFrame !== frame) {
    if (props.onFrame) props.onFrame()
    frame = newFrame
    render()
  }
}

function render() {
  if (!animatedSpriteSpriteRef.value) return
  const mesh: Mesh | Sprite = animatedSpriteSpriteRef.value

  const pageWidth = texture.image.width
  const pageHeight = texture.image.height

  const offsetX = frame!.left / pageWidth
  const offsetY = frame!.top / pageHeight
  const repeatX = frame!.width / pageWidth
  const repeatY = frame!.height / pageHeight

  const uv = mesh.geometry.getAttribute('uv')

  if (props.asSprite) {
    uv.setXY(3, offsetX + (props.flipX ? 1 : 0) * repeatX, 1 - offsetY)
    uv.setXY(2, offsetX + (props.flipX ? 0 : 1) * repeatX, 1 - offsetY)
    uv.setXY(0, offsetX + (props.flipX ? 1 : 0) * repeatX, 1 - offsetY - repeatY)
    uv.setXY(1, offsetX + (props.flipX ? 0 : 1) * repeatX, 1 - offsetY - repeatY)
  }
  else {
    uv.setXY(0, offsetX + (props.flipX ? 1 : 0) * repeatX, 1 - offsetY)
    uv.setXY(1, offsetX + (props.flipX ? 0 : 1) * repeatX, 1 - offsetY)
    uv.setXY(2, offsetX + (props.flipX ? 1 : 0) * repeatX, 1 - offsetY - repeatY)
    uv.setXY(3, offsetX + (props.flipX ? 0 : 1) * repeatX, 1 - offsetY - repeatY)
  }

  uv.needsUpdate = true

  scaleX.value = frame!.width * props.pxInWorldUnits
  scaleY.value = frame!.height * props.pxInWorldUnits

  positionX.value = -(props.anchor[0] - 0.5) * frame!.width * props.pxInWorldUnits
  positionY.value = (props.anchor[1] - 0.5) * frame!.height * props.pxInWorldUnits
};

watch(() => [props.animation], () => {
  animation = page.getFrames(props.animation)
  frameNum = 0
  cooldown = 1
  updateFrame(animation[frameNum])
  frameHeldOnLoopEnd = false
})

watch(() => [props.paused], () => {
  frameHeldOnLoopEnd = false
})

watch(() => [props.loop], () => {
  if (frameHeldOnLoopEnd && props.loop) frameHeldOnLoopEnd = false
})

watch(() => [props.flipX, props.asSprite], render)
</script>

<template>
  <TresGroup
    ref="{animatedSpriteGroupRef}"
    v-model="props"
  >
    <Suspense :fallback="null">
      <template v-if="props.asSprite">
        <TresSprite
          ref="animatedSpriteSpriteRef"
          :scale="[scaleX, scaleY, 1]"
          :position="[positionX, positionY, 0]"
        >
          <TresSpriteMaterial
            ref="animatedSpriteMaterialRef"
            :toneMapped="false"
            :map="animatedSpriteTextureRef"
            :transparent="true"
            :alphaTest="props.alphaTest"
          />
        </TresSprite>
      </template>
      <template v-else>
        <TresMesh :scale="0.2">
          <TresBoxGeometry />
          <TresMeshNormalMaterial />
        </TresMesh>
        <TresMesh
          ref="animatedSpriteSpriteRef"
          :scale="[scaleX, scaleY, 1]"
          :position="[positionX, positionY, 0]"
        >
          <TresPlaneGeometry :args="[1, 1]" />
          <TresMeshBasicMaterial
            ref="matRef"
            :toneMapped="false"
            :side="DoubleSide"
            :map="texture"
            :transparent="true"
            :alphaTest="props.alphaTest"
          />
        </TresMesh>
      </template>
    </Suspense>
    {children}
  </TresGroup>
</template>

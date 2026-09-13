import type { Gender } from '../shared-types/index.js';

export interface FaceConfig {
  faceId: string; gender: Gender; displayName: string; description?: string;
  assetResourceId: string; enabled: boolean; sortOrder: number;
}

const names = {
  MALE: ['晴朗', '清峻', '含笑'],
  FEMALE: ['晴音', '清雅', '笑颜']
} as const;

export const faceConfigs: FaceConfig[] = (['MALE', 'FEMALE'] as const).flatMap(gender =>
  names[gender].map((displayName, index) => ({
    faceId: `${gender === 'MALE' ? 'M' : 'F'}_FACE_0${index + 1}`,
    gender, displayName, assetResourceId: `PLAYER_${gender === 'MALE' ? 'M' : 'F'}_FACE_0${index + 1}`,
    enabled: true, sortOrder: index
  }))
);

export const availableFaces = (gender: Gender, faces: FaceConfig[] = faceConfigs) =>
  faces.filter(face => face.enabled && face.gender === gender).sort((a, b) => a.sortOrder - b.sortOrder);

export const defaultFaceId = (gender: Gender) => availableFaces(gender)[0].faceId;

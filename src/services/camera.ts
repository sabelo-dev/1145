import { Camera, CameraResultType } from '@capacitor/camera';

export async function takePicture() {
  return await Camera.getPhoto({
    quality: 90,
    allowEditing: true,
    resultType: CameraResultType.Uri,
  });
}
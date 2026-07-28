import { takePicture } from '@/services/camera';

const handleUpload = async () => {
  const image = await takePicture();
  console.log(image.webPath);
};
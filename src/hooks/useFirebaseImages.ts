
import { useState } from 'react';
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: Timestamp;
  userId: string;
}

export const useFirebaseImages = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const saveGeneratedImage = async (prompt: string, imageDataUrl: string) => {
    if (!user) {
      console.log('User not logged in, skipping save');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      
      const imageRef = ref(storage, `generated-images/${user.uid}/${Date.now()}.png`);
      await uploadBytes(imageRef, blob);
      const imageUrl = await getDownloadURL(imageRef);
      
      await addDoc(collection(db, 'generated-images'), {
        prompt,
        imageUrl,
        createdAt: Timestamp.now(),
        userId: user.uid,
      });

      toast.success('Image saved successfully!');
      return imageUrl;
    } catch (error) {
      console.error('Error saving image:', error);
      if (error.message?.includes('Missing or insufficient permissions') || 
          error.message?.includes('CORS')) {
        console.log('Firebase save failed due to permissions/CORS - this is expected in demo mode');
      } else {
        toast.error('Failed to save image');
      }
    } finally {
      setLoading(false);
    }
  };

  const getUserImages = async (): Promise<GeneratedImage[]> => {
    if (!user) return [];

    setLoading(true);
    try {
      const q = query(
        collection(db, 'generated-images'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const images: GeneratedImage[] = [];
      
      querySnapshot.forEach((doc) => {
        images.push({
          id: doc.id,
          ...doc.data(),
        } as GeneratedImage);
      });

      return images;
    } catch (error) {
      console.error('Error fetching images:', error);
      if (error.message?.includes('Missing or insufficient permissions')) {
        console.log('Firebase fetch failed due to permissions - this is expected in demo mode');
      } else {
        toast.error('Failed to fetch images');
      }
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    saveGeneratedImage,
    getUserImages,
    loading,
  };
};

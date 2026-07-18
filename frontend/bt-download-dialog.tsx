import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Tabs, TabList, TabTrigger, TabContent, Textarea } from '@/components/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export function BtDownloadDialog({ open, onClose, currentFolderId }: {
  open: boolean;
  onClose: () => void;
  currentFolderId: string;
}) {
  const [link, setLink] = useState('');
  const queryClient = useQueryClient();

  const createTask = useMutation({
    mutationFn: async (type: 'magnet' | 'url') => {
      await axios.post('/api/bt-task/create', {
        source: link,
        targetFolderId: currentFolderId,
        type,
      });
    },
    onSuccess: () => {
      onClose();
      setLink('');
      queryClient.invalidateQueries({ queryKey: ['btTasks'] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-white">
        <DialogHeader>
          <DialogTitle>🌀 离线BT下载</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="magnet">
          <TabList>
            <TabTrigger value="magnet">磁力链接</TabTrigger>
            <TabTrigger value="torrent">上传种子文件</TabTrigger>
          </TabList>
          <TabContent value="magnet">
            <Textarea
              placeholder="粘贴 magnet:?xt=xxxx 磁力链接"
              value={link}
              onChange={e => setLink(e.target.value)}
              className="bg-zinc-800"
            />
            <Button
              className="mt-4 bg-cyan-600 hover:bg-cyan-700 w-full"
              onClick={() => createTask.mutate('magnet')}
              disabled={createTask.isPending || !link}
            >
              创建下载任务
            </Button>
          </TabContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

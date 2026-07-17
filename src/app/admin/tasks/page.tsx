'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ArrowLeft, Plus, Edit, Trash2, FileText, CheckCircle, XCircle, Users, MessageSquare, Target, Award, TrendingUp, Calendar, Clock } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Task {
  id: string
  title: string
  description?: string
  category: string
  taskType: string
  targetValue: number
  xpReward: number
  pointsReward: number
  isActive: boolean
  order: number
  _count?: {
    completions: number // Periyod bazlı (günlük/haftalık/kalıcı)
    totalCompletions?: number // Toplam tüm zamanlar
  }
}

const TASK_CATEGORIES = [
  { value: 'daily', label: 'Günlük', icon: Calendar, color: 'cyan' },
  { value: 'weekly', label: 'Haftalık', icon: Clock, color: 'teal' },
  { value: 'streak', label: 'Seri', icon: TrendingUp, color: 'orange' },
  { value: 'permanent', label: 'Kalıcı', icon: Target, color: 'purple' }
]

// ✅ Mesaj ve çark türleri - tüm kategorilerde kullanılabilir
const TASK_TYPES = [
  { value: 'send_messages', label: 'Mesaj Gönder', icon: MessageSquare, description: 'Belirli sayıda mesaj göndermek', categories: ['daily', 'weekly', 'permanent'] },
  { value: 'spin_wheel', label: 'Çark Çevir', icon: Target, description: 'Belirli sayıda çark çevirmek', categories: ['daily', 'weekly', 'streak', 'permanent'] }
]

export default function AdminTasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'daily',
    taskType: 'send_messages',
    targetValue: 1,
    xpReward: 0,
    pointsReward: 0,
    isActive: true,
    order: 0
  })

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      router.push('/admin')
      return
    }
    loadTasks()
  }, [])

  async function loadTasks() {
    try {
      const response = await fetch('/api/admin/tasks')
      const data = await response.json()
      setTasks(data || [])
    } catch (error) {
      console.error('Error loading tasks:', error)
      toast.error('Görevler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  function openDialog(task?: Task) {
    if (task) {
      setEditingTask(task)
      setFormData({
        title: task.title,
        description: task.description || '',
        category: task.category,
        taskType: task.taskType,
        targetValue: task.targetValue,
        xpReward: task.xpReward,
        pointsReward: task.pointsReward,
        isActive: task.isActive,
        order: task.order
      })
    } else {
      setEditingTask(null)
      setFormData({
        title: '',
        description: '',
        category: 'daily',
        taskType: 'send_messages',
        targetValue: 1,
        xpReward: 0,
        pointsReward: 0,
        isActive: true,
        order: tasks.length
      })
    }
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingTask
        ? `/api/admin/tasks/${editingTask.id}`
        : '/api/admin/tasks'

      const method = editingTask ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.id || data.success) {
        toast.success(editingTask ? 'Görev güncellendi' : 'Görev eklendi')
        setDialogOpen(false)
        loadTasks()
      } else {
        toast.error('Bir hata oluştu')
      }
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Bir hata oluştu')
    }
  }

  async function handleDelete(id: string) {
    setDeleteId(id)
    setConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!deleteId) return

    try {
      const response = await fetch(`/api/admin/tasks/${deleteId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        toast.success('Görev silindi')
        loadTasks()
      } else {
        toast.error('Görev silinemedi')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Bir hata oluştu')
    } finally {
      setConfirmOpen(false)
      setDeleteId(null)
    }
  }

  function getTaskTypeLabel(type: string) {
    return TASK_TYPES.find(t => t.value === type)?.label || type
  }

  function getTaskTypeIcon(type: string) {
    const taskType = TASK_TYPES.find(t => t.value === type)
    const Icon = taskType?.icon || FileText
    return <Icon className="w-5 h-5" />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const dailyTasks = tasks.filter(t => t.category === 'daily')
  const weeklyTasks = tasks.filter(t => t.category === 'weekly')
  const streakTasks = tasks.filter(t => t.category === 'streak')
  const permanentTasks = tasks.filter(t => t.category === 'permanent')

  // Filter task types for the selected category in the dialog
  const filteredTaskTypes = TASK_TYPES.filter(type => type.categories.includes(formData.category))

  return (
    <div className="admin-page-container">
      <div className="admin-page-inner space-y-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="admin-page-title">Görev Yönetimi</h1>
            <p className="admin-text-muted">Detaylı görev sistemi ile kullanıcı aktivitelerini yönetin</p>
          </div>
          <Button
            onClick={() => openDialog()}
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Yeni Görev
          </Button>
        </div>

        {/* Günlük Görevler */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-cyan-400" />
            Günlük Görevler ({dailyTasks.length})
            <span className="text-xs text-gray-400 font-normal ml-2">Her gün 00:00'da sıfırlanır</span>
          </h2>
          <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
            {dailyTasks.length === 0 ? (
              <div className="p-12 text-center">
                <p className="admin-text-muted">Henüz günlük görev eklenmemiş</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black/40 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Görev</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tür</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Hedef</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Ödüller</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tamamlanma</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Durum</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {dailyTasks.map((task, index) => (
                      <tr key={task.id} className={index % 2 === 0 ? 'bg-[#1e1e2e]' : 'bg-[#252535]'} >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg">
                              {getTaskTypeIcon(task.taskType)}
                            </div>
                            <div>
                              <p className="text-white font-semibold">{task.title}</p>
                              {task.description && (
                                <p className="text-sm admin-page-subtitle whitespace-pre-line">{task.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300 text-sm">{getTaskTypeLabel(task.taskType)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                            {task.targetValue}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {task.xpReward > 0 && (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm">
                                {task.xpReward} XP
                              </span>
                            )}
                            {task.pointsReward > 0 && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-sm">
                                {task.pointsReward} Puan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {task._count && (
                            <div className="flex flex-col">
                              <span className="text-purple-300 text-sm font-medium">{task._count.completions} bugün</span>
                              {task._count.totalCompletions !== undefined && task._count.totalCompletions !== task._count.completions && (
                                <span className="text-gray-500 text-xs">({task._count.totalCompletions} toplam)</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {task.isActive ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => openDialog(task)}
                              size="sm"
                              className="bg-blue-500 hover:bg-blue-600 admin-text-primary"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(task.id)}
                              size="sm"
                              className="bg-red-500 hover:bg-red-600 admin-text-primary"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Haftalık Görevler */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-400" />
            Haftalık Görevler ({weeklyTasks.length})
            <span className="text-xs text-gray-400 font-normal ml-2">Her Pazartesi 00:00'da sıfırlanır</span>
          </h2>
          <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
            {weeklyTasks.length === 0 ? (
              <div className="p-12 text-center">
                <p className="admin-text-muted">Henüz haftalık görev eklenmemiş</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black/40 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Görev</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tür</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Hedef</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Ödüller</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tamamlanma</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Durum</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {weeklyTasks.map((task, index) => (
                      <tr key={task.id} className={index % 2 === 0 ? 'bg-[#1e1e2e]' : 'bg-[#252535]'} >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg">
                              {getTaskTypeIcon(task.taskType)}
                            </div>
                            <div>
                              <p className="text-white font-semibold">{task.title}</p>
                              {task.description && (
                                <p className="text-sm admin-page-subtitle whitespace-pre-line">{task.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300 text-sm">{getTaskTypeLabel(task.taskType)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                            {task.targetValue}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {task.xpReward > 0 && (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm">
                                {task.xpReward} XP
                              </span>
                            )}
                            {task.pointsReward > 0 && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-sm">
                                {task.pointsReward} Puan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {task._count && (
                            <div className="flex flex-col">
                              <span className="text-purple-300 text-sm font-medium">{task._count.completions} bu hafta</span>
                              {task._count.totalCompletions !== undefined && task._count.totalCompletions !== task._count.completions && (
                                <span className="text-gray-500 text-xs">({task._count.totalCompletions} toplam)</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {task.isActive ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => openDialog(task)}
                              size="sm"
                              className="bg-blue-500 hover:bg-blue-600 admin-text-primary"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(task.id)}
                              size="sm"
                              className="bg-red-500 hover:bg-red-600 admin-text-primary"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Seri (Streak) Görevler */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-400" />
            Seri Görevler ({streakTasks.length})
            <span className="text-xs text-gray-400 font-normal ml-2">Ardışık günlerde tamamlanır</span>
          </h2>
          <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
            {streakTasks.length === 0 ? (
              <div className="p-12 text-center">
                <p className="admin-text-muted">Henüz seri görev eklenmemiş</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black/40 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Görev</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tür</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Hedef</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Ödüller</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tamamlanma</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Durum</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {streakTasks.map((task, index) => (
                      <tr key={task.id} className={index % 2 === 0 ? 'bg-[#1e1e2e]' : 'bg-[#252535]'} >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-lg">
                              {getTaskTypeIcon(task.taskType)}
                            </div>
                            <div>
                              <p className="text-white font-semibold">{task.title}</p>
                              {task.description && (
                                <p className="text-sm admin-page-subtitle whitespace-pre-line">{task.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-gray-300 text-sm">{getTaskTypeLabel(task.taskType)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                            {task.targetValue}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {task.xpReward > 0 && (
                              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm">
                                {task.xpReward} XP
                              </span>
                            )}
                            {task.pointsReward > 0 && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-sm">
                                {task.pointsReward} Puan
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {task._count && (
                            <div className="flex flex-col">
                              <span className="text-purple-300 text-sm font-medium">{task._count.completions} seri</span>
                              {task._count.totalCompletions !== undefined && task._count.totalCompletions !== task._count.completions && (
                                <span className="text-gray-500 text-xs">({task._count.totalCompletions} toplam)</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {task.isActive ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              onClick={() => openDialog(task)}
                              size="sm"
                              className="bg-blue-500 hover:bg-blue-600 admin-text-primary"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(task.id)}
                              size="sm"
                              className="bg-red-500 hover:bg-red-600 admin-text-primary"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Kalıcı Görevler */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Kalıcı Görevler ({permanentTasks.length})
            <span className="text-xs text-gray-400 font-normal ml-2">Bir kez tamamlanır, sıfırlanmaz</span>
          </h2>
          <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden">
            {permanentTasks.length === 0 ? (
              <div className="p-12 text-center">
                <p className="admin-text-muted">Henüz kalıcı görev eklenmemiş</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-black/40 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Görev</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tür</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Hedef</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Ödüller</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Tamamlanma</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Durum</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {permanentTasks.map((task, index) => (
                    <tr key={task.id} className={index % 2 === 0 ? 'bg-[#1e1e2e]' : 'bg-[#252535]'} >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/5 rounded-lg">
                            {getTaskTypeIcon(task.taskType)}
                          </div>
                          <div>
                            <p className="text-white font-semibold">{task.title}</p>
                            {task.description && (
                              <p className="text-sm admin-page-subtitle whitespace-pre-line">{task.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300 text-sm">{getTaskTypeLabel(task.taskType)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-sm">
                          {task.targetValue}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {task.xpReward > 0 && (
                            <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-sm">
                              {task.xpReward} XP
                            </span>
                          )}
                          {task.pointsReward > 0 && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-sm">
                              {task.pointsReward} Puan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {task._count && (
                          <span className="text-purple-300 text-sm font-medium">{task._count.completions} toplam</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {task.isActive ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => openDialog(task)}
                            size="sm"
                            className="bg-blue-500 hover:bg-blue-600 admin-text-primary"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDelete(task.id)}
                            size="sm"
                            className="bg-red-500 hover:bg-red-600 admin-text-primary"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingTask ? 'Görevi Düzenle' : 'Yeni Görev Ekle'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Temel Bilgiler */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Temel Bilgiler</h3>

              <div>
                <Label>Görev Başlığı *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Örn: 5 Mesaj Gönder"
                  required
                  className="bg-slate-800 border-slate-700"
                />
              </div>

              <div>
                <Label>Açıklama</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Görev hakkında detaylı açıklama (opsiyonel)"
                  className="bg-slate-800 border-slate-700 min-h-[80px]"
                />
              </div>
            </div>

            {/* Görev Tipi ve Kategori */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Görev Tipi</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Kategori *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      // Change taskType to first available for new category
                      const availableTypes = TASK_TYPES.filter(type => type.categories.includes(value))
                      setFormData({
                        ...formData,
                        category: value,
                        taskType: availableTypes[0]?.value || ''
                      })
                    }}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs admin-page-subtitle">
                    {formData.category === 'daily' && 'Her gün 00:00\'da sıfırlanır'}
                    {formData.category === 'weekly' && 'Her Pazartesi 00:00\'da sıfırlanır'}
                    {formData.category === 'streak' && 'Ardışık günlerde tamamlanır'}
                    {formData.category === 'permanent' && 'Bir kez tamamlanır, sıfırlanmaz'}
                  </p>
                </div>

                <div>
                  <Label>Görev Türü *</Label>
                  <Select
                    value={formData.taskType}
                    onValueChange={(value) => setFormData({ ...formData, taskType: value })}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredTaskTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs admin-page-subtitle">
                    {TASK_TYPES.find(t => t.value === formData.taskType)?.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Hedef ve Ödüller */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Hedef ve Ödüller</h3>

              <div>
                <Label>Hedef Değer *</Label>
                <Input
                  type="number"
                  value={formData.targetValue}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 1 : Number(e.target.value)
                    setFormData({ ...formData, targetValue: val })
                  }}
                  className="bg-slate-800 border-slate-700"
                  min="1"
                  required
                />
                <p className="text-xs admin-page-subtitle">
                  {formData.taskType === 'send_messages' && `${formData.targetValue} mesaj göndermek gerekir`}
                  {formData.taskType === 'spin_wheel' && formData.category === 'streak' && `${formData.targetValue} ardışık gün çark çevirmek gerekir`}
                  {formData.taskType === 'spin_wheel' && formData.category !== 'streak' && `${formData.targetValue} kez çark çevirmek gerekir`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>XP Ödülü</Label>
                  <Input
                    type="number"
                    value={formData.xpReward}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value)
                      setFormData({ ...formData, xpReward: val })
                    }}
                    className="bg-slate-800 border-slate-700"
                    min="0"
                  />
                </div>
                <div>
                  <Label>Puan Ödülü</Label>
                  <Input
                    type="number"
                    value={formData.pointsReward}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value)
                      setFormData({ ...formData, pointsReward: val })
                    }}
                    className="bg-slate-800 border-slate-700"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Diğer Ayarlar */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Diğer Ayarlar</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gösterim Sırası</Label>
                  <Input
                    type="number"
                    value={formData.order}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value)
                      setFormData({ ...formData, order: val })
                    }}
                    className="bg-slate-800 border-slate-700"
                    min="0"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-700 bg-slate-800"
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">Görevi Aktif Et</Label>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 justify-end pt-4 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="admin-btn-outline"
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600"
              >
                {editingTask ? 'Güncelle' : 'Ekle'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Görev Silme"
        description={`Bu görevi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

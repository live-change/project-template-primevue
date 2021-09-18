<template>
  <div class="todo">

    <ConfirmPopup v-if="isMounted"></ConfirmPopup>
    <Toast v-if="isMounted"></Toast>


  </div>
</template>

<script>
import DataTable from "primevue/datatable"
import Column from "primevue/column"

import TextArea from "primevue/textarea"
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'

import ConfirmPopup from 'primevue/confirmpopup'
import Toast from 'primevue/toast'

import { reactive, ref, computed } from 'vue'

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

export default {
  components: { DataTable, Column, Checkbox, TextArea, Button, ConfirmPopup, Toast },
  data() {
    const testTasks = [
      { id: 1, text: "Zainstalować prime vue  1", done: true, order: 0 },
      { id: 2, text: "Dodać usuwanie", done: true, order: 2 },
      { id: 3, text: "Dodać dodawanie", done: false, order: 3 },
      { id: 4, text: "No co tam? Robimy TODO?\nNo robimy!", order: 4 }
    ]
    return {
      serverTasks: JSON.parse(JSON.stringify(testTasks)).map(t => ({ ...t, lastUpdate: new Date().toISOString() })),
      localTasks: JSON.parse(JSON.stringify(testTasks)).map(t => ({ ...t, lastUpdate: '' })),
      localyDeletedTasks: [],
      isMounted: false,
      lastChange: new Date(),
      lastSave: new Date(),
      saving: false
    }
  },
  mounted() {
    this.isMounted = true
  },
  created() {
    this.saveInterval = setInterval(() => this.saveIfNeeded(), 1000)
  },
  beforeDestroy() {
    clearTimeout(this.saveInterval)
  },
  computed: {
    editable() {
      return true
    },
    tasks() {
      const clearServerTasks = this.serverTasks.filter(task => !this.localyDeletedTasks.includes(task.id))
      const normalTasks = clearServerTasks.map((serverTask) => {
        const localTask = this.localTasks.find(task => task.id == serverTask.id)
        const computedText = computed({
          get: () => localTask.lastUpdate > serverTask.lastUpdate ? localTask.text : serverTask.text,
          set: text => {
            this.handleChange()
            localTask.text = text
            localTask.lastUpdate = new Date().toISOString()
          }
        })
        const computedDone = computed({
          get: () => localTask.lastUpdate > serverTask.lastUpdate ? localTask.done : serverTask.done,
          set: done => {
            this.handleChange()
            localTask.done = done
            localTask.lastUpdate = new Date().toISOString()
          }
        })
        const computedOrder = computed({
          get: () => localTask.lastUpdate > serverTask.lastUpdate ? localTask.order : serverTask.order
        })
        const task = reactive({
          id: serverTask.id,
          text: computedText,
          done: computedDone,
          order: computedOrder
        })
        console.log("TASK", task)
        return task
      }).filter(task => !!task).sort((a, b) => a.order - b.order)
      if(!this.editable) return normalTasks
      return normalTasks.concat([
        { text: "", done: false } /// empty task
      ])
    }
  },
  methods: {
    resetName() {
      this.workingZone.addPromise('delete name', this.$actions.sessionName.resetSessionName())
    },
    handleRowReorder(event) {
      console.log("LLL", event)
      if(!this.editable) return
      if(this.editable && event.dragIndex + 1 == this.tasks.length) return
      const tasks = this.tasks.map(task => task.id)
      if(event.dragIndex > event.dropIndex) { // move up
        for(let i = event.dropIndex; i < event.dragIndex; i++) {
          const localTask = this.localTasks.find(task => task.id == tasks[i])
          localTask.order += 1
          localTask.lastUpdate = new Date().toISOString()
        }
        const localDraggedTask = this.localTasks.find(task => task.id == tasks[event.dragIndex])
        localDraggedTask.order = event.dropIndex
        localDraggedTask.lastUpdate = new Date().toISOString()
      } else { // move down
        const localDraggedTask = this.localTasks.find(task => task.id == tasks[event.dragIndex])
        localDraggedTask.order = event.dropIndex
        localDraggedTask.lastUpdate = new Date().toISOString()
        for(let i = event.dragIndex + 1; i < event.dropIndex + 1; i++) {
          const localTask = this.localTasks.find(task => task.id == tasks[i])
          localTask.order -= 1
          localTask.lastUpdate = new Date().toISOString()
        }
      }
      this.localTasks.sort((a, b) => a.order - b.order)
      this.handleChange()
    },
    deleteTask(event,id) {
      if(!this.editable) return
      this.$confirm.require({
        target: event.currentTarget,
        message: 'Do you want to delete this task?',
        icon: 'pi pi-info-circle',
        acceptClass: 'p-button-danger',
        accept: async () => {
          const index = this.localTasks.findIndex(task => task.id == id)
          this.localTasks.splice(index, 1)
          this.localyDeletedTasks.push(id)
          this.handleChange()
          this.$toast.add({ severity:'info', summary: 'Task deleted', life: 1500 });
        },
        reject: () => {
          this.$toast.add({ severity:'error', summary: 'Rejected', detail: 'You have rejected', life: 3000 });
        }
      })
    },
    saveIfNeeded() {
      if(this.lastSave.getTime() >= this.lastChange.getTime()) return // nothing changed
      const timeFromLastChange = Date.now() - this.lastChange.getTime()
      const timeFromLastSave = Date.now() - this.lastChange.getTime()
      if( (timeFromLastSave > 1000 && timeFromLastChange > 1000) ||
          (timeFromLastSave > 5000 && timeFromLastChange > 300) ||
          (timeFromLastSave > 20000) ) {
        this.saveChanges()
      }
    },
    async saveChanges() {
      if(this.saving) return
      this.saving = true
      try {
        const deletedList = this.localyDeletedTasks.slice()
        await sleep(500)
        this.serverTasks = JSON.parse(JSON.stringify(this.localTasks))
            .filter(task => !deletedList.includes())
            .map(task => ({ ...task, lastUpdated: task.lastUpdate || new Date().toISOString() }))
        this.lastSave = new Date()
        this.$toast.add({severity: 'info', summary: 'Saved', life: 1000 })
        setTimeout(() => {
          this.localyDeletedTasks = this.localyDeletedTasks.filter(id => !deletedList.includes(id))
        }, 5000)
      } catch(error) {
        this.$toast.add({severity: 'error', summary: 'Save error', detail: error.message, life: 3000 })
      }
      this.saving = false
    },
    handleChange() {
      this.lastChange = new Date()
      // if(this.saveTimeout) clearTimeout(this.saveTimeout)
      // this.saveTimeout = setTimeout(() => this.saveChanges(), 1000)
    }
  }
}
</script>

<style lang="scss">
  .todo {
    .p-datatable-thead {
      display: none;
    }

    .task {

      .task-reorder-cell {
        width: 10px;
        .reorder-area {
          width: 10px;
          height: 20px;
        }
      }

      &:hover {
        .task-reorder-cell .reorder-area{
          background-image: radial-gradient(black 1.5px, transparent 0);
          background-size: 5px 5px;
          background-position: 0px 0px;
        }
      }

      &.task-done {
        .task-text {
          text-decoration: line-through;
          color: var(--text-color-secondary);
        }
      }

      .task-done-cell {
        width: 30px;
      }

      .task-delete-cell {
        width: 40px;
      }

      .task-text-cell {
        padding-top: 6px !important;
        padding-bottom: 0 !important;
        vertical-align: middle;

        .task-text {
          border: none;
          width: 100%;
        }
      }
    }
  }
</style>
